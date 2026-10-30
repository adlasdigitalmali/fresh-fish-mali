(() => {
  const cfg=window.FRESH_FISH_CONFIG||{};
  const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.startsWith("COLLER_")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const client=configured&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;
  const $=id=>document.getElementById(id);
  const notice=$("setupNotice"),login=$("loginPanel"),dashboard=$("dashboard");
  let allProducts=[];
  const orderStatuses=["en_attente","confirmee","en_preparation","en_livraison","livree","annulee"];
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n||0))+" FCFA";
  const normalizeSearch=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").trim();
  async function removeProductImage(publicUrl){
    if(!publicUrl||!client)return;
    try{const marker="/storage/v1/object/public/products/";const path=decodeURIComponent(new URL(publicUrl).pathname.split(marker)[1]||"");if(path){const {error}=await client.storage.from("products").remove([path]);if(error)console.warn("Image non supprimée du stockage :",error.message);}}
    catch(err){console.warn("URL d’image non reconnue, fichier conservé :",err);}
  }
  async function deleteProduct(id,name,button){
    if(!window.confirm(`Supprimer définitivement « ${name} » ? Cette action est irréversible.`))return;
    button.disabled=true;button.textContent="Suppression…";
    const {count,error:itemsError}=await client.from("order_items").select("id",{count:"exact",head:true}).eq("product_id",id);
    if(itemsError){toast("Impossible de vérifier l’historique des commandes : "+itemsError.message);button.disabled=false;button.textContent="Supprimer";return;}
    if(count>0){toast("Ce produit figure dans l’historique des commandes. Désactivez-le plutôt que de le supprimer.");button.disabled=false;button.textContent="Supprimer";return;}
    const product=allProducts.find(p=>String(p.id)===String(id));
    const {error}=await client.from("products").delete().eq("id",id);
    if(error){toast("Suppression refusée : "+error.message);button.disabled=false;button.textContent="Supprimer";return;}
    if(product?.image_url)await removeProductImage(product.image_url);
    toast("Produit supprimé.");await loadProducts();
  }
  function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800);}
  // Vérifie et renouvelle si nécessaire la session avant toute écriture protégée par RLS.
  async function ensureAdminSession(){
    let {data:{session},error}=await client.auth.getSession();
    if(error) throw new Error("Impossible de vérifier la session : "+error.message);
    if(!session){
      const refreshed=await client.auth.refreshSession();
      session=refreshed.data?.session||null;
      if(refreshed.error) throw new Error("Session expirée : reconnectez-vous à l’administration.");
    }
    if(!session) throw new Error("Session absente : reconnectez-vous à l’administration.");
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user) throw new Error("Authentification non confirmée : reconnectez-vous à l’administration.");
    if(user.id!==session.user.id) throw new Error("La session administrateur a changé. Reconnectez-vous.");
    return user;
  }

  async function init(){
    if(!client){notice.classList.remove("hidden");return;}
    notice.classList.add("hidden");
    const {data:{session},error}=await client.auth.getSession();
    if(error){showLogin();return;}
    if(session) await showDashboard(session); else showLogin();
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>session?showDashboard(session):showLogin(),0);});
  }
  function showLogin(){login.classList.remove("hidden");dashboard.classList.add("hidden");$("logoutBtn").classList.add("hidden");}
  async function showDashboard(session){
    login.classList.add("hidden");dashboard.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("adminEmail").textContent=session.user.email||"Compte connecté";
    await Promise.all([loadProducts(),loadOrders(),loadCategories(),loadAccountingAndReports()]);
  }
  // Navigation entre les rubriques du panneau d'administration.
  function showView(name){
    const views=[...dashboard.querySelectorAll(".admin-view[data-page]")];
    const target=views.find(view=>view.dataset.page===name);
    if(!target) return;
    views.forEach(view=>view.classList.toggle("hidden",view!==target));
    dashboard.querySelectorAll(".sidebar-link[data-view]").forEach(link=>{
      const active=link.dataset.view===name;
      link.classList.toggle("active",active);
      link.setAttribute("aria-current",active?"page":"false");
    });
    $("adminSidebar").classList.remove("mobile-open");
    const toggle=$("sidebarMobileToggle");
    if(toggle) toggle.setAttribute("aria-expanded","false");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  dashboard.querySelectorAll(".sidebar-link[data-view]").forEach(link=>{
    link.addEventListener("click",()=>showView(link.dataset.view));
  });
  const mobileToggle=$("sidebarMobileToggle");
  if(mobileToggle){
    mobileToggle.setAttribute("aria-expanded","false");
    mobileToggle.addEventListener("click",()=>{
      const sidebar=$("adminSidebar");
      const opened=sidebar.classList.toggle("mobile-open");
      mobileToggle.setAttribute("aria-expanded",String(opened));
    });
  }
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!client)return;const btn=e.submitter;btn.disabled=true;btn.textContent="Connexion…";const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("loginError").textContent=error?error.message:"";btn.disabled=false;btn.innerHTML='Se connecter <span>→</span>';if(error)return;toast("Connexion réussie.");});
  $("logoutBtn").addEventListener("click",async()=>{if(client)await client.auth.signOut();});
  async function uploadProductImage(file,identity){
    const allowed=["image/jpeg","image/png","image/webp"];
    if(!allowed.includes(file.type))throw new Error("Format image accepté : JPG, PNG ou WebP.");
    if(file.size>2*1024*1024)throw new Error("L’image ne doit pas dépasser 2 Mo.");
    const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
    const path=`${String(identity).replace(/[^a-zA-Z0-9_-]/g,"-")}-${Date.now()}.${ext}`;
    const {error}=await client.storage.from("products").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error("Envoi de l’image impossible : "+error.message);
    const {data}=client.storage.from("products").getPublicUrl(path);
    return data.publicUrl;
  }
  async function loadProducts(){
    const {data,error}=await client.from("products").select("id,nom,slug,prix_fcfa,unite,stock,actif,image_url,created_at").order("created_at",{ascending:false});
    if(error){$("productsTable").innerHTML=`<tr><td colspan="6">Erreur de lecture : ${esc(error.message)}</td></tr>`;return;}
    allProducts=data||[]; $("statProducts").textContent=allProducts.filter(p=>p.actif).length;$("statLowStock").textContent=allProducts.filter(p=>Number(p.stock)<=5).length;
    const {data:cats}=await client.from("categories").select("id,nom").eq("actif",true).order("nom");
    $("pCategory").innerHTML='<option value="">Sans catégorie</option>'+(cats||[]).map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join("");
    renderProducts();
  }
  function renderProducts(){
    const q=normalizeSearch($("productSearch")?.value||"");
    const rows=allProducts.filter(p=>normalizeSearch([p.nom,p.slug,p.unite].join(" ")).includes(q));
    $("productCount").textContent=`${rows.length} produit(s)`;
    $("productsTable").innerHTML=rows.map(p=>`<tr>
      <td><strong>${esc(p.nom)}</strong><small class="slug">${esc(p.slug)}</small></td>
      <td>${money(p.prix_fcfa)}</td><td>${esc(p.unite)}</td>
      <td><span class="stock-pill ${Number(p.stock)<=5?"low":""}">${esc(p.stock)}</span></td>
      <td><span class="status ${p.actif?"active":"inactive"}">${p.actif?"Actif":"Inactif"}</span></td>
      <td><div class="actions"><button class="table-btn primary" data-edit="${esc(p.id)}">Modifier</button><button class="table-btn" data-toggle="${esc(p.id)}" data-active="${p.actif}">${p.actif?"Désactiver":"Activer"}</button><button class="table-btn danger" data-delete="${esc(p.id)}" data-name="${esc(p.nom)}">Supprimer</button></div></td>
    </tr>`).join("")||'<tr><td colspan="6" class="empty">Aucun produit trouvé.</td></tr>';
    $("productsTable").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openDrawer(b.dataset.edit)));
    $("productsTable").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete,b.dataset.name,b)));
    $("productsTable").querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",async()=>{
      b.disabled=true;
      try{
        await ensureAdminSession();
        const {data,error}=await client.from("products")
          .update({actif:b.dataset.active!=="true"})
          .eq("id",b.dataset.toggle)
          .select("id,actif")
          .maybeSingle();
        if(error) throw error;
        if(!data) throw new Error("Aucun produit modifié. Vérifiez les droits administrateur (RLS).");
        toast("Statut du produit mis à jour.");
        await loadProducts();
      }catch(error){
        toast("Modification refusée : "+(error.message||"Erreur inconnue"));
        b.disabled=false;
      }
    }));
  }
  function openDrawer(id){
    const p=allProducts.find(x=>String(x.id)===String(id));if(!p)return;
    $("editProductId").value=p.id;
    $("drawerProductName").textContent=p.nom||"Produit";
    $("editPrice").value=p.prix_fcfa??0;
    $("editUnit").value=p.unite||"kg";
    $("editStock").value=p.stock??0;
    $("editActive").value=String(Boolean(p.actif));
    $("editImageFile").value="";
    $("editProductMessage").textContent="";
    $("editProductMessage").className="message";
    $("productDrawer").classList.add("open");
    $("drawerBackdrop").classList.add("open");
    $("productDrawer").setAttribute("aria-hidden","false");
    $("drawerBackdrop").setAttribute("aria-hidden","false");
    document.body.classList.add("drawer-open");
    setTimeout(()=>$("editPrice").focus(),100);
  }
  function closeDrawer(){
    $("productDrawer").classList.remove("open");
    $("drawerBackdrop").classList.remove("open");
    $("productDrawer").setAttribute("aria-hidden","true");
    $("drawerBackdrop").setAttribute("aria-hidden","true");
    document.body.classList.remove("drawer-open");
  }
  $("closeDrawer").addEventListener("click",closeDrawer);
  $("cancelDrawer").addEventListener("click",closeDrawer);
  $("drawerBackdrop").addEventListener("click",closeDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer();});
  $("editProductForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const id=$("editProductId").value;
    const priceRaw=$("editPrice").value.trim(),stockRaw=$("editStock").value.trim();
    const price=Number(priceRaw),stock=Number(stockRaw),unit=$("editUnit").value,active=$("editActive").value==="true";
    if(priceRaw===""||!Number.isFinite(price)||price<0||stockRaw===""||!Number.isFinite(stock)||stock<0){
      $("editProductMessage").textContent="Le prix et le stock doivent être des nombres positifs.";
      $("editProductMessage").className="message error";return;
    }
    const btn=$("saveEditBtn");btn.disabled=true;btn.textContent="Enregistrement…";
    const previousProduct=allProducts.find(p=>String(p.id)===String(id));
    let imageUrl=previousProduct?.image_url||null;
    const file=$("editImageFile").files[0];
    if(file){try{imageUrl=await uploadProductImage(file,id);}catch(err){btn.disabled=false;btn.textContent="Enregistrer les modifications";$("editProductMessage").textContent=err.message;return;}}
    let updateError=null,updatedRow=null;
    try{
      await ensureAdminSession();
      const result=await client.from("products")
        .update({prix_fcfa:Math.round(price),unite:unit,stock:stock,actif:active,image_url:imageUrl})
        .eq("id",id)
        .select("id")
        .maybeSingle();
      updateError=result.error;updatedRow=result.data;
      if(!updateError&&!updatedRow) updateError=new Error("Aucun produit modifié. Vérifiez les droits administrateur (RLS).");
    }catch(err){updateError=err;}
    btn.disabled=false;btn.textContent="Enregistrer les modifications";
    if(updateError){
      $("editProductMessage").textContent="Échec de l’enregistrement : "+updateError.message;
      $("editProductMessage").className="message error";return;
    }
    closeDrawer();if(file&&previousProduct?.image_url)await removeProductImage(previousProduct.image_url);toast("Produit mis à jour avec succès.");await loadProducts();
  });
  $("productSearch").addEventListener("input",renderProducts);
  async function loadCategories(){
    const {data,error}=await client.from("categories").select("id,nom,slug,actif").order("id");
    if(error){$("categoriesTable").innerHTML=`<tr><td colspan="4">${esc(error.message)}</td></tr>`;return;}
    $("categoriesTable").innerHTML=(data||[]).map(c=>`<tr><td>${esc(c.nom)}</td><td>${esc(c.slug)}</td><td>${c.actif?"Active":"Masquée"}</td><td><button type="button" class="table-btn" data-category-toggle="${c.id}" data-active="${c.actif}">${c.actif?"Masquer":"Activer"}</button></td></tr>`).join("")||'<tr><td colspan="4">Aucune catégorie.</td></tr>';
    $("categoriesTable").querySelectorAll("[data-category-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;const {error}=await client.from("categories").update({actif:btn.dataset.active!=="true"}).eq("id",btn.dataset.categoryToggle);if(error){toast("Catégorie non modifiée : "+error.message);btn.disabled=false;return;}toast("Catégorie mise à jour.");await loadCategories();await loadProducts();}));
  }
  async function loadAccountingAndReports(){
    const [{data:orders,error:ordersError},{data:products,error:productsError}]=await Promise.all([
      client.from("orders").select("total_fcfa,statut,statut_paiement"),
      client.from("products").select("prix_fcfa,stock,actif")
    ]);
    if(ordersError||productsError){$("accountingNote").textContent="Impossible de calculer les indicateurs : "+(ordersError||productsError).message;return;}
    const list=orders||[],delivered=list.filter(o=>o.statut==="livree"),pending=list.filter(o=>["en_attente","confirmee","en_preparation","en_livraison"].includes(o.statut));
    const revenue=delivered.reduce((sum,o)=>sum+Number(o.total_fcfa||0),0);
    $("accountingRevenue").textContent=money(revenue);$("accountingDelivered").textContent=String(delivered.length);$("accountingPending").textContent=String(pending.length);
    const ps=products||[],stockValue=ps.reduce((sum,p)=>sum+(p.actif?Number(p.prix_fcfa||0)*Number(p.stock||0):0),0);
    $("reportProducts").textContent=String(ps.filter(p=>p.actif).length);$("reportStockValue").textContent=money(stockValue);$("reportOrders").textContent=String(list.length);
  }
  async function loadOrders(){
    const {data,error}=await client.from("orders").select("id,numero,nom_client,total_fcfa,statut,created_at").order("created_at",{ascending:false}).limit(10);
    if(error){$("ordersTable").innerHTML=`<tr><td colspan="5">Commandes non accessibles : ${esc(error.message)}</td></tr>`;$("statOrders").textContent="—";return;}
    $("statOrders").textContent=(data||[]).length;
    $("ordersTable").innerHTML=(data||[]).map(o=>`<tr><td>${esc(o.numero||o.id)}</td><td>${esc(o.nom_client)}</td><td>${money(o.total_fcfa)}</td><td><select class="order-status-select" data-order-status="${esc(o.id)}" aria-label="Statut de la commande ${esc(o.numero)}">${orderStatuses.map(st=>`<option value="${st}" ${o.statut===st?"selected":""}>${st.replaceAll("_"," ")}</option>`).join("")}</select></td><td>${new Date(o.created_at).toLocaleDateString("fr-FR")}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">Aucune commande pour le moment.</td></tr>';
    $("ordersTable").querySelectorAll("[data-order-status]").forEach(sel=>sel.addEventListener("change",async()=>{sel.disabled=true;const {error}=await client.from("orders").update({statut:sel.value}).eq("id",sel.dataset.orderStatus);sel.disabled=false;if(error){toast("Statut non modifié : "+error.message);await loadOrders();return;}toast("Statut de commande mis à jour.");}));
  }
  $("pName").addEventListener("input",()=>{if(!$("pSlug").dataset.touched)$("pSlug").value=$("pName").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");});
  $("pSlug").addEventListener("input",()=>{$("pSlug").dataset.touched="1";});
  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!client)return;const btn=e.submitter;btn.disabled=true;btn.textContent="Enregistrement…";
    const slug=$("pSlug").value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
    let imageUrl=null;
    const imageFile=$("pImageFile").files[0];
    try{if(imageFile)imageUrl=await uploadProductImage(imageFile,slug);}catch(err){btn.disabled=false;btn.textContent="＋ Enregistrer le produit";$("productMessage").textContent=err.message;$("productMessage").className="message error";return;}
    const item={nom:$("pName").value.trim(),slug,description:$("pDescription").value.trim()||null,categorie_id:$("pCategory").value?Number($("pCategory").value):null,prix_fcfa:Number($("pPrice").value),unite:$("pUnit").value,stock:Number($("pStock").value),image_url:imageUrl,actif:true};
    const {error}=await client.from("products").insert(item);
    btn.disabled=false;btn.textContent="＋ Enregistrer le produit";
    if(error){$("productMessage").textContent="Erreur : "+error.message;$("productMessage").className="message error";return;}
    $("productMessage").textContent="Produit enregistré avec succès.";$("productMessage").className="message success";$("productForm").reset();$("pStock").value="0";delete $("pSlug").dataset.touched;await loadProducts();toast("Produit ajouté.");
  });
  init();
})();