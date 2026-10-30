-- Fresh Fish Mali — correctifs Supabase déployés
-- Le script est idempotent sur les objets créés ici. Ne pas supprimer les données existantes.

-- Index pour les relations et les tris courants
create index if not exists idx_products_categorie_id on public.products(categorie_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- Limitation simple des commandes répétées par numéro (hash du téléphone, pas de numéro en clair)
create table if not exists private.order_rate_limits (
  phone_hash text not null,
  created_at timestamptz not null default now()
);
alter table private.order_rate_limits enable row level security;
create index if not exists idx_order_rate_limits_phone_created on private.order_rate_limits(phone_hash, created_at desc);

-- Fonction interne privilégiée : validation, verrouillage stock, calcul serveur, insertion atomique
create or replace function private.create_order_core(
  p_customer_name text, p_phone text, p_address text, p_notes text, p_payment text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := pg_catalog.btrim(p_customer_name);
  v_phone text := pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_address text := pg_catalog.btrim(coalesce(p_address, ''));
  v_payment text := coalesce(p_payment, 'especes');
  v_item jsonb; v_product record; v_product_id bigint; v_qty numeric;
  v_subtotal numeric := 0; v_order_id bigint; v_order_number text;
  v_uid uuid := auth.uid(); v_count integer; v_phone_hash text;
begin
  if v_name is null or pg_catalog.length(v_name) < 2 or pg_catalog.length(v_name) > 120 then raise exception 'Le nom doit contenir entre 2 et 120 caractères.' using errcode='22023'; end if;
  if pg_catalog.length(v_phone) < 8 or pg_catalog.length(v_phone) > 15 then raise exception 'Le numéro de téléphone est invalide.' using errcode='22023'; end if;
  if pg_catalog.length(v_address) < 4 or pg_catalog.length(v_address) > 500 then raise exception 'Veuillez préciser une adresse de livraison valide.' using errcode='22023'; end if;
  if v_payment not in ('especes','orange_money','moov_money') then raise exception 'Mode de paiement non accepté.' using errcode='22023'; end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then raise exception 'Le panier est invalide.' using errcode='22023'; end if;
  select count(*) into v_count from pg_catalog.jsonb_array_elements(p_items);
  if v_count < 1 or v_count > 30 then raise exception 'Le panier doit contenir entre 1 et 30 références.' using errcode='22023'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_items) e group by e.value->>'product_id' having count(*)>1) then raise exception 'Le panier contient un produit en double.' using errcode='22023'; end if;
  -- Verrouiller les lignes dans un ordre stable pour éviter les ventes concurrentes du dernier stock.
  for v_product_id in select (e.value->>'product_id')::bigint from pg_catalog.jsonb_array_elements(p_items) e order by (e.value->>'product_id')::bigint loop
    perform 1 from public.products p where p.id=v_product_id for update;
    if not found then raise exception 'Un produit du panier n’existe plus.' using errcode='22023'; end if;
  end loop;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    begin v_product_id := (v_item->>'product_id')::bigint; v_qty := (v_item->>'quantity')::numeric;
    exception when others then raise exception 'Une quantité ou une référence produit est invalide.' using errcode='22023'; end;
    if v_qty<=0 or v_qty>500 then raise exception 'La quantité demandée est invalide.' using errcode='22023'; end if;
    select p.id,p.nom,p.prix_fcfa,p.unite,p.stock,p.actif into v_product from public.products p where p.id=v_product_id;
    if not found or not v_product.actif then raise exception 'Un produit du panier n’est plus disponible.' using errcode='22023'; end if;
    if v_product.prix_fcfa<=0 then raise exception 'Un produit est disponible uniquement sur devis. Contactez-nous.' using errcode='22023'; end if;
    if v_product.stock<v_qty then raise exception 'Stock insuffisant pour : % (disponible : %).',v_product.nom,v_product.stock using errcode='22023'; end if;
    v_subtotal:=v_subtotal+(v_product.prix_fcfa*v_qty);
  end loop;
  v_phone_hash:=pg_catalog.md5(v_phone);
  select count(*) into v_count from private.order_rate_limits r where r.phone_hash=v_phone_hash and r.created_at>pg_catalog.now()-interval '10 minutes';
  if v_count>=3 then raise exception 'Trop de commandes récentes pour ce numéro. Réessayez dans quelques minutes.' using errcode='P0001'; end if;
  insert into private.order_rate_limits(phone_hash) values(v_phone_hash);
  delete from private.order_rate_limits where created_at<pg_catalog.now()-interval '2 days';
  v_order_number:='FFM-'||pg_catalog.to_char(pg_catalog.now(),'YYMMDD')||'-'||pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders(numero,user_id,nom_client,telephone,adresse_livraison,notes,sous_total_fcfa,frais_livraison_fcfa,total_fcfa,statut,paiement,statut_paiement)
  values(v_order_number,v_uid,v_name,v_phone,v_address,nullif(pg_catalog.btrim(coalesce(p_notes,'')),''),v_subtotal,0,v_subtotal,'en_attente',v_payment,'non_paye') returning id into v_order_id;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    v_product_id:=(v_item->>'product_id')::bigint; v_qty:=(v_item->>'quantity')::numeric;
    select p.id,p.nom,p.prix_fcfa,p.unite into v_product from public.products p where p.id=v_product_id;
    insert into public.order_items(order_id,product_id,nom_produit,quantite,unite,prix_unitaire_fcfa,total_ligne_fcfa)
    values(v_order_id,v_product.id,v_product.nom,v_qty,v_product.unite,v_product.prix_fcfa,v_product.prix_fcfa*v_qty);
    update public.products set stock=stock-v_qty where id=v_product_id;
  end loop;
  return pg_catalog.jsonb_build_object('id',v_order_id,'numero',v_order_number,'sous_total_fcfa',v_subtotal,'frais_livraison_fcfa',0,'total_fcfa',v_subtotal,'statut','en_attente');
end; $$;

-- Fonction interne de suivi : ne retourne que les champs non sensibles après vérification téléphone + numéro
create or replace function private.track_order_core(p_order_number text,p_phone text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_phone text:=pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); v_order record;
begin
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_order_number,'')))<8 or pg_catalog.length(v_phone)<8 or pg_catalog.length(v_phone)>15 then raise exception 'Numéro de commande ou téléphone invalide.' using errcode='22023'; end if;
  select o.numero,o.nom_client,o.statut,o.total_fcfa,o.created_at into v_order from public.orders o where o.numero=pg_catalog.btrim(p_order_number) and pg_catalog.regexp_replace(o.telephone,'[^0-9]','','g')=v_phone limit 1;
  if not found then raise exception 'Commande introuvable. Vérifiez le numéro et le téléphone.' using errcode='P0002'; end if;
  return pg_catalog.jsonb_build_object('numero',v_order.numero,'nom_client',v_order.nom_client,'statut',v_order.statut,'total_fcfa',v_order.total_fcfa,'created_at',v_order.created_at);
end; $$;

-- Points d'entrée REST en SECURITY INVOKER ; les opérations privilégiées restent dans private.
create or replace function public.create_order(p_customer_name text,p_phone text,p_address text,p_notes text,p_payment text,p_items jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.create_order_core(p_customer_name,p_phone,p_address,p_notes,p_payment,p_items);
$$;
create or replace function public.track_order(p_order_number text,p_phone text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.track_order_core(p_order_number,p_phone);
$$;

grant usage on schema private to anon, authenticated;
revoke all on function private.create_order_core(text,text,text,text,text,jsonb) from public;
revoke all on function private.track_order_core(text,text) from public;
grant execute on function private.create_order_core(text,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function private.track_order_core(text,text) to anon, authenticated;
revoke all on function public.create_order(text,text,text,text,text,jsonb) from public;
revoke all on function public.track_order(text,text) from public;
grant execute on function public.create_order(text,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.track_order(text,text) to anon, authenticated;
notify pgrst,'reload schema';
