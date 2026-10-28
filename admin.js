(() => {
  const cfg=window.FRESH_FISH_CONFIG||{};
  const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.startsWith("COLLER_")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const client=configured&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;
  const $=id=>document.getElementById(id);
  const notice=$("setupNotice"),login=$("loginPanel"),dashboard=$("dashboard");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n||0))+" FCFA";
  function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600);}
  async function init(){
    if(!client){notice.classList.remove("hidden");login.classList.add("hidden");return;}
    notice.classList.add("hidden");
    const {data:{session}}=await client.auth.getSession();
    if(session){await showDashboard(session);}else{login.classList.remove("hidden");dashboard.classList.add("hidden");$("logoutBtn").classList.add("hidden");}
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>session?showDashboard(session):showLogin(),0);});
  }
  function showLogin(){login.classList.remove("hidden");dashboard.classList.add("hidden");$("logoutBtn").classList.add("hidden");}
  async function showDashboard(session){
    login.classList.add("hidden");dashboard.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("adminEmail").textContent=session.user.email||"Compte connecté";
    await Promise.all([loadProducts(),loadOrders()]);
  }
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!client)return;const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("loginError").textContent=error?error.message:"";if(error) return;toast("Connexion réussie.");});
  $("logoutBtn").addEventListener("click",async()=>{if(client)await client.auth.signOut();});
  async function loadProducts(){
    const {data,error}=await client.from("products").select("id,nom,slug,prix_fcfa,unite,stock,actif").order("created_at",{ascending:false});
    if(error){$("productsTable").innerHTML=`<tr><td colspan="6">Erreur de lecture : ${esc(error.message)}</td></tr>`;return;}
    $("statProducts").textContent=(data||[]).filter(p=>p.actif).length;
    $("statLowStock").textContent=(data||[]).filter(p=>Number(p.stock)<=5).length;
    $("productsTable").innerHTML=(data||[]).map(p=>`<tr><td>${esc(p.nom)}</td><td>${money(p.prix_fcfa)}</td><td>${esc(p.unite)}</td><td>${esc(p.stock)}</td><td>${p.actif?"Oui":"Non"}</td><td><button data-toggle="${p.id}" data-active="${p.actif}">${p.actif?"Désactiver":"Activer"}</button></td></tr>`).join("")||'<tr><td colspan="6">Aucun produit.</td></tr>';
    $("productsTable").querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await client.from("products").update({actif:b.dataset.active!=="true"}).eq("id",b.dataset.toggle);if(error){toast("Modification refusée : "+error.message);return;}await loadProducts();}));
    const {data:cats}=await client.from("categories").select("id,nom").eq("actif",true).order("nom");
    $("pCategory").innerHTML='<option value="">Sans catégorie</option>'+(cats||[]).map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join("");
  }
  async function loadOrders(){
    const {data,error}=await client.from("orders").select("id,numero,nom_client,total_fcfa,statut,created_at").order("created_at",{ascending:false}).limit(10);
    if(error){$("ordersTable").innerHTML=`<tr><td colspan="5">Lecture limitée par les règles de sécurité. Les commandes ne sont pas affichées à ce compte.</td></tr>`;$("statOrders").textContent="—";return;}
    $("statOrders").textContent=(data||[]).length;
    $("ordersTable").innerHTML=(data||[]).map(o=>`<tr><td>${esc(o.numero)}</td><td>${esc(o.nom_client)}</td><td>${money(o.total_fcfa)}</td><td>${esc(o.statut)}</td><td>${new Date(o.created_at).toLocaleDateString("fr-FR")}</td></tr>`).join("")||'<tr><td colspan="5">Aucune commande.</td></tr>';
  }
  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!client)return;
    const slug=$("pSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,"-");
    const item={nom:$("pName").value.trim(),slug,description:$("pDescription").value.trim()||null,categorie_id:$("pCategory").value?Number($("pCategory").value):null,prix_fcfa:Number($("pPrice").value),unite:$("pUnit").value,stock:Number($("pStock").value),image_url:$("pImage").value.trim()||null,actif:true};
    const {error}=await client.from("products").insert(item);
    if(error){$("productMessage").textContent="Erreur : "+error.message;return;}
    $("productMessage").textContent="Produit enregistré."; $("productForm").reset();$("pStock").value="0";await loadProducts();toast("Produit ajouté.");
  });
  init();
})();