(() => {
  const cfg = window.FRESH_FISH_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("COLLER_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById("productGrid");
  const message = document.getElementById("productMessage");
  const cart = [];
  let selectedCategory = "all";
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
    const list = products.filter(p => selectedCategory==="all" || p.categorie===selectedCategory || String(p.categorie_id)===selectedCategory);
    if (!list.length) { grid.innerHTML='<p>Aucun produit dans cette catégorie pour le moment.</p>'; return; }
    grid.innerHTML = list.map(p => `<article class="product-card"><div class="product-image">${p.image_url ? `<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.nom)}">` : `<div class="image-placeholder"><span>FRESH FISH</span><small>Photo produit à ajouter</small></div>`}</div><div class="product-info"><span class="product-category">${esc(categoryMap[p.categorie] || "Notre sélection")}</span><h3>${esc(p.nom)}</h3><p class="product-desc">${esc(p.description || "Produit sélectionné par Fresh Fish Mali.")}</p><div class="product-price">${Number(p.prix_fcfa) > 0 ? money(p.prix_fcfa) : "Sur devis"} <small>/ ${esc(p.unite || "kg")}</small></div><button class="add-button" data-add="${esc(p.id)}" data-name="${esc(p.nom)}" data-price="${Number(p.prix_fcfa)||0}">Ajouter au panier</button></div></article>`).join("");
    grid.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>{
      const item = cart.find(x=>String(x.id)===btn.dataset.add);
      if(item) item.qty++; else cart.push({id:btn.dataset.add,name:btn.dataset.name,price:Number(btn.dataset.price),qty:1});
      document.getElementById("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
      showToast(btn.dataset.price==="0" ? "Produit ajouté. Contactez-nous pour le prix." : "Produit ajouté au panier.");
    }));
  }
  function showToast(text){const el=document.getElementById("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
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