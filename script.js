(() => {
  const cfg = window.FRESH_FISH_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("COLLER_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById("productGrid");
  const message = document.getElementById("productMessage");
  const cart = [];
  const favorites = new Set(JSON.parse(localStorage.getItem("ffm_favorites") || "[]"));
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
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(products) {
    currentProducts = products;
    const list = products.filter(p => (selectedCategory==="all" || p.categorie===selectedCategory || String(p.categorie_id)===selectedCategory) && String(p.nom||"").toLocaleLowerCase("fr").includes(searchQuery));
    if (!list.length) { grid.innerHTML='<p>Aucun produit dans cette catégorie pour le moment.</p>'; return; }
    grid.innerHTML = list.map(p => `<article class="product-card" tabindex="0" role="button" data-detail="${esc(p.id)}" aria-label="Voir les détails de ${esc(p.nom)}"><div class="product-image">${p.image_url ? `<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.nom)}">` : `<div class="image-placeholder"><span>FRESH FISH</span><small>Photo produit à ajouter</small></div>`}</div><div class="product-info"><span class="product-category">${esc(categoryMap[p.categorie] || "Notre sélection")}</span><h3>${esc(p.nom)}</h3><p class="product-desc">${esc(p.description || "Produit sélectionné par Fresh Fish Mali.")}</p><div class="product-price">${Number(p.prix_fcfa) > 0 ? money(p.prix_fcfa) : "Sur devis"} <small>/ ${esc(p.unite || "kg")}</small></div><button class="favorite-mini ${favorites.has(String(p.id))?"is-favorite":""}" type="button" data-favorite="${esc(p.id)}" aria-label="Ajouter aux favoris">♡</button><button class="add-button" data-add="${esc(p.id)}" data-name="${esc(p.nom)}" data-price="${Number(p.prix_fcfa)||0}">Ajouter au panier</button></div></article>`).join("");
    grid.querySelectorAll("[data-detail]").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("button"))return;openProduct(card.dataset.detail);}));
    grid.querySelectorAll("[data-detail]").forEach(card=>card.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest("button")){e.preventDefault();openProduct(card.dataset.detail);}}));
    grid.querySelectorAll("[data-favorite]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();toggleFavorite(btn.dataset.favorite);render(currentProducts);}));
    grid.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();
      const item = cart.find(x=>String(x.id)===btn.dataset.add);
      if(item) item.qty++; else cart.push({id:btn.dataset.add,name:btn.dataset.name,price:Number(btn.dataset.price),qty:1});
      document.getElementById("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
      updateCartCount();showToast(btn.dataset.price==="0" ? "Produit ajouté. Contactez-nous pour le prix." : "Produit ajouté au panier.");
    }));
  }
  function showToast(text){const el=document.getElementById("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
  function updateCartCount(){document.getElementById("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);document.getElementById("favoriteCount").textContent=favorites.size;}
  function toggleFavorite(id){id=String(id);favorites.has(id)?favorites.delete(id):favorites.add(id);localStorage.setItem("ffm_favorites",JSON.stringify([...favorites]));updateCartCount();showToast(favorites.has(id)?"Ajouté aux favoris.":"Retiré des favoris.");}
  function openProduct(id){const p=currentProducts.find(x=>String(x.id)===String(id));if(!p)return;const modal=document.getElementById("productModal");document.getElementById("modalProductContent").innerHTML=`<div class="modal-product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.nom)}">`:`<div class="image-placeholder"><span>FRESH FISH MALI</span><small>Photo non disponible</small></div>`}</div><p class="eyebrow">${esc(categoryMap[p.categorie]||"Notre sélection")}</p><h2 id="modalProductName">${esc(p.nom)}</h2><p>${esc(p.description||"Produit sélectionné par Fresh Fish Mali.")}</p><p class="modal-price">${Number(p.prix_fcfa)>0?money(p.prix_fcfa):"Prix sur devis"} <small>/ ${esc(p.unite||"kg")}</small></p><p class="modal-stock">${Number(p.stock)>0?`Disponibilité : ${esc(p.stock)} ${esc(p.unite||"kg")}`:"Disponibilité à confirmer"}</p><div class="modal-actions"><button class="btn btn-outline" id="modalFavorite">${favorites.has(String(p.id))?"Retirer des favoris":"Ajouter aux favoris"}</button><button class="btn btn-primary" id="modalAdd">Ajouter au panier</button></div>`;modal.hidden=false;document.body.classList.add("modal-open");document.getElementById("modalFavorite").onclick=()=>{toggleFavorite(p.id);openProduct(p.id);};document.getElementById("modalAdd").onclick=()=>{const item=cart.find(x=>String(x.id)===String(p.id));if(item)item.qty++;else cart.push({id:p.id,name:p.nom,price:Number(p.prix_fcfa)||0,qty:1});updateCartCount();modal.hidden=true;document.body.classList.remove("modal-open");showToast("Produit ajouté au panier.");};}
  function openSidePanel(favOnly=false){const backdrop=document.getElementById("sideBackdrop"),content=document.getElementById("sidePanelContent");document.getElementById("sidePanelTitle").textContent=favOnly?"Mes favoris":"Mon panier";const rows=favOnly?currentProducts.filter(p=>favorites.has(String(p.id))):cart.map(c=>({...c,nom:c.name,unite:currentProducts.find(p=>String(p.id)===String(c.id))?.unite||"kg"}));content.innerHTML=rows.length?rows.map(p=>`<div class="panel-line"><div><strong>${esc(p.nom)}</strong><small>${favOnly?(Number(p.prix_fcfa)>0?money(p.prix_fcfa):"Sur devis"):`${p.qty} × ${money(p.price)} (${esc(p.unite)})`}</small></div>${favOnly?`<button data-open-product="${esc(p.id)}">Voir</button>`:`<button data-remove-cart="${esc(p.id)}">Retirer</button>`}</div>`).join("")+(favOnly?"":`<p class="cart-total">Total : ${money(cart.reduce((n,x)=>n+x.price*x.qty,0))}</p><p class="small-note">Pour finaliser votre commande, contactez notre équipe.</p><a class="btn btn-primary" href="#contact" id="orderContact">Passer à la commande</a>`):'<p>Aucun élément pour le moment.</p>';backdrop.hidden=false;document.body.classList.add("modal-open");content.querySelectorAll("[data-open-product]").forEach(b=>b.onclick=()=>{backdrop.hidden=true;document.body.classList.remove("modal-open");openProduct(b.dataset.openProduct);});content.querySelectorAll("[data-remove-cart]").forEach(b=>b.onclick=()=>{const i=cart.findIndex(x=>String(x.id)===b.dataset.removeCart);if(i>=0)cart.splice(i,1);updateCartCount();openSidePanel(false);});const order=document.getElementById("orderContact");if(order)order.onclick=()=>{backdrop.hidden=true;document.body.classList.remove("modal-open");};}
  document.getElementById("siteSearch").addEventListener("input",e=>{searchQuery=e.target.value.trim().toLocaleLowerCase("fr");render(currentProducts);});
  document.getElementById("favoritesButton").addEventListener("click",()=>openSidePanel(true));
  document.getElementById("cartButton").addEventListener("click",()=>openSidePanel(false));
  document.getElementById("closeProductModal").addEventListener("click",()=>{document.getElementById("productModal").hidden=true;document.body.classList.remove("modal-open");});
  document.getElementById("closeSidePanel").addEventListener("click",()=>{document.getElementById("sideBackdrop").hidden=true;document.body.classList.remove("modal-open");});
  document.getElementById("productModal").addEventListener("click",e=>{if(e.target.id==="productModal"){e.currentTarget.hidden=true;document.body.classList.remove("modal-open");}});
  document.getElementById("sideBackdrop").addEventListener("click",e=>{if(e.target.id==="sideBackdrop"){e.currentTarget.hidden=true;document.body.classList.remove("modal-open");}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.getElementById("productModal").hidden=true;document.getElementById("sideBackdrop").hidden=true;document.body.classList.remove("modal-open");}});
  updateCartCount();
  async function loadProducts(){
    if(!supabase){render(fallbackProducts);message.textContent="Mode aperçu : configurez config.js puis ajoutez vos produits dans Supabase. Les prix de démonstration ne sont pas des tarifs confirmés.";return;}
    const {data,error}=await supabase.from("products").select("id,nom,description,prix_fcfa,unite,image_url,categorie_id,actif").eq("actif",true).order("created_at",{ascending:false});
    if(error){render(fallbackProducts);message.textContent="Impossible de charger les produits depuis Supabase. Vérifiez la configuration et les règles d'accès.";console.error(error);return;}
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