(() => {
  const cfg = window.FRESH_FISH_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("COLLER_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById("productGrid");
  const message = document.getElementById("productMessage");
  const cart = [];
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem("ffm_favorites") || "[]")); }
  catch (_) { try { localStorage.removeItem("ffm_favorites"); } catch (_) {} }
  let currentProducts = [];
  let selectedCategory = "all";
  let searchQuery = "";
  const fallbackProducts = [
    {id:"demo1",nom:"Poisson entier",description:"Sélection du jour — disponibilité à confirmer",prix_fcfa:2500,unite:"kg",categorie:"entiers",image_url:""},
    {id:"demo2",nom:"Filets de poisson",description:"Pratique pour vos recettes du quotidien",prix_fcfa:3500,unite:"kg",categorie:"decoupes",image_url:""},
    {id:"demo3",nom:"Poisson découpé",description:"Préparé selon vos besoins",prix_fcfa:2800,unite:"kg",categorie:"decoupes",image_url:""},
    {id:"demo4",nom:"Carton de poissons",description:"Format adapté aux professionnels",prix_fcfa:0,unite:"carton",categorie:"lots",image_url:""}
  ];
  const categoryMap = {"entiers":"Poissons entiers","decoupes":"Découpés & filets","lots":"Cartons & lots"};
  const money = n => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n||0))+" FCFA";
  const normalizeText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(products) {
    currentProducts = products;
    const list = products.filter(p => {
      const categoryMatches = selectedCategory === "all" || p.categorie === selectedCategory || String(p.categorie_id) === selectedCategory;
      const searchable = normalizeText([p.nom, p.description, p.unite, categoryMap[p.categorie], p.slug].join(" "));
      return categoryMatches && (!searchQuery || searchable.includes(searchQuery));
    });
    if (!list.length) {
      grid.innerHTML = `<div class="search-empty"><strong>Aucun résultat trouvé</strong><span>Essayez un autre mot-clé ou choisissez une autre catégorie.</span><button type="button" id="clearSearch">Effacer la recherche</button></div>`;
      const clear = document.getElementById("clearSearch");
      if (clear) clear.addEventListener("click", () => { const input=document.getElementById("siteSearch"); input.value=""; searchQuery=""; render(currentProducts); input.focus(); });
      return;
    }
    grid.innerHTML = list.map(p => `<article class="product-card" tabindex="0" role="button" data-detail="${esc(p.id)}" aria-label="Voir les détails de ${esc(p.nom)}"><div class="product-image">${p.image_url ? `<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.nom)}">` : `<div class="image-placeholder"><span>FRESH FISH</span><small>Photo produit à ajouter</small></div>`}</div><div class="product-info"><span class="product-category">${esc(categoryMap[p.categorie] || "Notre sélection")}</span><h3>${esc(p.nom)}</h3><p class="product-desc">${esc(p.description || "Produit sélectionné par Fresh Fish Mali.")}</p><div class="product-price">${Number(p.prix_fcfa) > 0 ? money(p.prix_fcfa) : "Sur devis"} <small>/ ${esc(p.unite || "kg")}</small></div><button class="favorite-mini ${favorites.has(String(p.id))?"is-favorite":""}" type="button" data-favorite="${esc(p.id)}" aria-label="Ajouter aux favoris">♡</button><button class="add-button" data-add="${esc(p.id)}" data-name="${esc(p.nom)}" data-price="${Number(p.prix_fcfa)||0}" data-stock="${Number(p.stock)||0}" ${Number(p.stock)<=0?"disabled":""}>${Number(p.stock)<=0?"Indisponible":"Ajouter au panier"}</button></div></article>`).join("");
    grid.querySelectorAll("[data-detail]").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("button"))return;openProduct(card.dataset.detail);}));
    grid.querySelectorAll("[data-detail]").forEach(card=>card.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest("button")){e.preventDefault();openProduct(card.dataset.detail);}}));
    grid.querySelectorAll("[data-favorite]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();toggleFavorite(btn.dataset.favorite);render(currentProducts);}));
    grid.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();
      const item = cart.find(x=>String(x.id)===btn.dataset.add);
      const available=Number(btn.dataset.stock)||0;
      if((item?item.qty:0)+1>available){showToast("Stock disponible insuffisant.");return;}
      if(item) item.qty++; else cart.push({id:btn.dataset.add,name:btn.dataset.name,price:Number(btn.dataset.price),qty:1});
      document.getElementById("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
      updateCartCount();showToast(btn.dataset.price==="0" ? "Produit ajouté. Contactez-nous pour le prix." : "Produit ajouté au panier.");
    }));
  }
  function showToast(text){const el=document.getElementById("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
  function updateCartCount(){document.getElementById("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);document.getElementById("favoriteCount").textContent=favorites.size;}
  function toggleFavorite(id){id=String(id);favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem("ffm_favorites",JSON.stringify([...favorites]));}catch(e){showToast("Favoris indisponibles dans ce navigateur.");}updateCartCount();showToast(favorites.has(id)?"Ajouté aux favoris.":"Retiré des favoris.");}
  function openProduct(id){const p=currentProducts.find(x=>String(x.id)===String(id));if(!p)return;const modal=document.getElementById("productModal");document.getElementById("modalProductContent").innerHTML=`<div class="modal-product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.nom)}">`:`<div class="image-placeholder"><span>FRESH FISH MALI</span><small>Photo non disponible</small></div>`}</div><p class="eyebrow">${esc(categoryMap[p.categorie]||"Notre sélection")}</p><h2 id="modalProductName">${esc(p.nom)}</h2><p>${esc(p.description||"Produit sélectionné par Fresh Fish Mali.")}</p><p class="modal-price">${Number(p.prix_fcfa)>0?money(p.prix_fcfa):"Prix sur devis"} <small>/ ${esc(p.unite||"kg")}</small></p><p class="modal-stock">${Number(p.stock)>0?`Disponibilité : ${esc(p.stock)} ${esc(p.unite||"kg")}`:"Disponibilité à confirmer"}</p><div class="modal-actions"><button class="btn btn-outline" id="modalFavorite">${favorites.has(String(p.id))?"Retirer des favoris":"Ajouter aux favoris"}</button><button class="btn btn-primary" id="modalAdd" ${Number(p.stock)<=0?"disabled":""}>${Number(p.stock)<=0?"Indisponible":"Ajouter au panier"}</button></div>`;modal.hidden=false;document.body.classList.add("modal-open");document.getElementById("modalFavorite").onclick=()=>{toggleFavorite(p.id);openProduct(p.id);};document.getElementById("modalAdd").onclick=()=>{const item=cart.find(x=>String(x.id)===String(p.id));if((item?item.qty:0)+1>Number(p.stock||0)){showToast("Stock disponible insuffisant.");return;}if(item)item.qty++;else cart.push({id:p.id,name:p.nom,price:Number(p.prix_fcfa)||0,qty:1});updateCartCount();modal.hidden=true;document.body.classList.remove("modal-open");showToast("Produit ajouté au panier.");};}
  function openSidePanel(favOnly=false){
    const backdrop=document.getElementById("sideBackdrop"),content=document.getElementById("sidePanelContent");
    document.getElementById("sidePanelTitle").textContent=favOnly?"Mes favoris":"Mon panier";
    const rows=favOnly?currentProducts.filter(p=>favorites.has(String(p.id))):cart.map(c=>({...c,nom:c.name,unite:currentProducts.find(p=>String(p.id)===String(c.id))?.unite||"kg"}));
    content.innerHTML=rows.length?rows.map(p=>`<div class="panel-line"><div><strong>${esc(p.nom)}</strong><small>${favOnly?(Number(p.prix_fcfa)>0?money(p.prix_fcfa):"Sur devis"):`${p.qty} × ${money(p.price)} (${esc(p.unite)})`}</small></div>${favOnly?`<button type="button" data-open-product="${esc(p.id)}">Voir</button>`:`<button type="button" data-remove-cart="${esc(p.id)}">Retirer</button>`}</div>`).join("")+(favOnly?"":`<p class="cart-total">Total indicatif : ${money(cart.reduce((n,x)=>n+x.price*x.qty,0))}</p>${cart.some(x=>x.price<=0)?'<p class="small-note">Un article est disponible sur devis. Retirez-le pour commander en ligne.</p>':`<form id="checkoutForm" class="checkout-form">
      <label>Nom complet<input name="customer_name" required minlength="2" maxlength="120" autocomplete="name"></label>
      <label>Téléphone<input name="phone" type="tel" required minlength="8" maxlength="20" autocomplete="tel" placeholder="Ex. 76123456"></label>
      <label>Adresse de livraison<input name="address" required minlength="4" maxlength="500" autocomplete="street-address" placeholder="Quartier, rue, repère"></label>
      <label>Mode de paiement<select name="payment" required><option value="especes">Espèces à la livraison</option><option value="orange_money">Orange Money</option><option value="moov_money">Moov Money</option></select></label>
      <label>Instructions (facultatif)<textarea name="notes" maxlength="500" rows="2"></textarea></label>
      <p id="checkoutMessage" class="small-note" role="status"></p>
      <button class="btn btn-primary" id="checkoutSubmit" type="submit">Confirmer la commande</button>
    </form>`}`):'<p>Aucun élément pour le moment.</p>';
    backdrop.hidden=false;document.body.classList.add("modal-open");
    content.querySelectorAll("[data-open-product]").forEach(b=>b.onclick=()=>{backdrop.hidden=true;document.body.classList.remove("modal-open");openProduct(b.dataset.openProduct);});
    content.querySelectorAll("[data-remove-cart]").forEach(b=>b.onclick=()=>{const i=cart.findIndex(x=>String(x.id)===b.dataset.removeCart);if(i>=0)cart.splice(i,1);updateCartCount();openSidePanel(false);});
    const form=document.getElementById("checkoutForm");
    if(form) form.addEventListener("submit",submitOrder);
  }
  async function submitOrder(e){
    e.preventDefault();
    const form=e.currentTarget, btn=form.querySelector("button[type=submit]"), msg=document.getElementById("checkoutMessage");
    if(!supabase){msg.textContent="Service de commande indisponible.";return;}
    if(!cart.length||cart.some(x=>!Number.isFinite(Number(x.id))||x.price<=0)){msg.textContent="Votre panier contient un article non commandable.";return;}
    const fd=new FormData(form);
    const payload={p_customer_name:String(fd.get("customer_name")).trim(),p_phone:String(fd.get("phone")).trim(),p_address:String(fd.get("address")).trim(),p_notes:String(fd.get("notes")||"").trim(),p_payment:String(fd.get("payment")),p_items:cart.map(x=>({product_id:Number(x.id),quantity:Number(x.qty)}))};
    btn.disabled=true;btn.textContent="Validation…";msg.textContent="Vérification du stock et enregistrement…";
    const {data,error}=await supabase.rpc("create_order",payload);
    btn.disabled=false;btn.textContent="Confirmer la commande";
    if(error){msg.textContent=error.message||"La commande n'a pas pu être enregistrée.";return;}
    cart.splice(0,cart.length);updateCartCount();
    const orderNo=data.numero;
    const wa=String(cfg.WHATSAPP_NUMBER||"").replace(/\D/g,"");
    const text=`Bonjour Fresh Fish Mali, ma commande ${orderNo} vient d'être enregistrée. Nom : ${payload.p_customer_name}. Total : ${money(data.total_fcfa)}. Merci de me confirmer la livraison.`;
    const waLink=wa?`https://wa.me/${wa}?text=${encodeURIComponent(text)}`:"";
    const msgHtml=`<strong>Commande enregistrée !</strong><br>Votre numéro : <strong>${esc(orderNo)}</strong><br>Conservez ce numéro pour suivre votre commande.<br>${waLink?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${waLink}">Envoyer le numéro sur WhatsApp</a>`:""}`;
    msg.innerHTML=msgHtml;
    form.reset();
    const track=document.getElementById("orderTrackingResult");
    if(track) track.textContent=`Commande ${orderNo} enregistrée.`;
    showToast("Commande enregistrée avec succès.");
  }
  const siteSearch = document.getElementById("siteSearch");
  siteSearch.addEventListener("input", e => {
    searchQuery = normalizeText(e.target.value);
    render(currentProducts);
    const clearButton = document.getElementById("clearSearch");
    if (clearButton) clearButton.addEventListener("click", () => { siteSearch.value=""; searchQuery=""; render(currentProducts); siteSearch.focus(); });
  });
  siteSearch.addEventListener("keydown", e => { if (e.key === "Escape") { siteSearch.value=""; searchQuery=""; render(currentProducts); } });
  document.getElementById("favoritesButton").addEventListener("click",()=>openSidePanel(true));
  document.getElementById("cartButton").addEventListener("click",()=>openSidePanel(false));
  document.getElementById("closeProductModal").addEventListener("click",()=>{document.getElementById("productModal").hidden=true;document.body.classList.remove("modal-open");});
  document.getElementById("closeSidePanel").addEventListener("click",()=>{document.getElementById("sideBackdrop").hidden=true;document.body.classList.remove("modal-open");});
  document.getElementById("productModal").addEventListener("click",e=>{if(e.target.id==="productModal"){e.currentTarget.hidden=true;document.body.classList.remove("modal-open");}});
  document.getElementById("sideBackdrop").addEventListener("click",e=>{if(e.target.id==="sideBackdrop"){e.currentTarget.hidden=true;document.body.classList.remove("modal-open");}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.getElementById("productModal").hidden=true;document.getElementById("sideBackdrop").hidden=true;document.body.classList.remove("modal-open");}});
  updateCartCount();
  const trackingForm=document.getElementById("trackingForm");
  if(trackingForm) trackingForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const out=document.getElementById("orderTrackingResult");
    if(!supabase){out.textContent="Le suivi est momentanément indisponible.";return;}
    const fd=new FormData(trackingForm),button=trackingForm.querySelector("button[type=submit]");
    button.disabled=true;button.textContent="Recherche…";out.textContent="";
    const {data,error}=await supabase.rpc("track_order",{p_order_number:String(fd.get("order_number")).trim(),p_phone:String(fd.get("phone")).trim()});
    button.disabled=false;button.textContent="Consulter";
    if(error){out.textContent=error.message||"Commande introuvable.";return;}
    const labels={en_attente:"En attente de confirmation",confirmee:"Confirmée",en_preparation:"En préparation",en_livraison:"En livraison",livree:"Livrée",annulee:"Annulée"};
    out.textContent=`Commande ${data.numero} — ${labels[data.statut]||data.statut} — ${money(data.total_fcfa)}.`;
  });
  async function loadProducts(){
    if(!supabase){render([]);message.textContent="La boutique est momentanément indisponible. Veuillez réessayer plus tard.";return;}
    const {data,error}=await supabase.from("products").select("id,nom,description,prix_fcfa,unite,stock,image_url,categorie_id,actif").eq("actif",true).order("created_at",{ascending:false});
    if(error){render([]);message.textContent="Impossible de charger les produits. Veuillez réessayer ultérieurement.";console.error(error);return;}
    const {data:cats}=await supabase.from("categories").select("id,nom,slug").eq("actif",true);
    const mapped=(data||[]).map(p=>({...p,categorie:(cats||[]).find(c=>c.id===p.categorie_id)?.slug||"entiers"}));
    render(mapped);message.textContent=mapped.length ? "Les prix et disponibilités sont à confirmer avant validation de la commande." : "Aucun produit publié pour le moment. Ajoutez des produits depuis l'administration.";
  }
  document.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-category]").forEach(x=>x.classList.remove("active"));b.classList.add("active");selectedCategory=b.dataset.category;loadProducts();}));
  document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("mainNav").classList.toggle("open"));
  document.querySelectorAll("#mainNav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("mainNav").classList.remove("open")));
  document.getElementById("year").textContent=new Date().getFullYear();
  const wa = String(cfg.WHATSAPP_NUMBER||"").replace(/\D/g,"");
  const phone = String(cfg.PHONE_NUMBER||"").trim();
  const contact = document.getElementById("contactButton");
  if(wa){contact.href=`https://wa.me/${wa}?text=${encodeURIComponent("Bonjour Fresh Fish Mali, je souhaite des informations sur vos produits.")}`;contact.target="_blank";contact.rel="noopener";}
  else if(phone){contact.href=`tel:${phone}`;}
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target);}}),{threshold:.12}) : null;
  document.querySelectorAll(".reveal").forEach(el=>observer?observer.observe(el):el.classList.add("visible"));
  loadProducts();
})();