(() => {
  const cfg=window.FRESH_FISH_CONFIG||{};
  const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.startsWith("COLLER_")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.startsWith("COLLER_");
  const client=configured&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;
  const $=id=>document.getElementById(id);
  const notice=$("setupNotice"),login=$("loginPanel"),dashboard=$("dashboard");
  let allProducts=[];
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n||0))+" FCFA";
  function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800);}
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
    await Promise.all([loadProducts(),loadOrders()]);
  }
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!client)return;const btn=e.submitter;btn.disabled=true;btn.textContent="Connexion…";const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("loginError").textContent=error?error.message:"";btn.disabled=false;btn.innerHTML='Se connecter <span>→</span>';if(error)return;toast("Connexion réussie.");});
  $("logoutBtn").addEventListener("click",async()=>{if(client)await client.auth.signOut();});
  async function loadProducts(){
    const {data,error}=await client.from("products").select("id,nom,slug,prix_fcfa,unite,stock,actif,created_at").order("created_at",{ascending:false});
    if(error){$("productsTable").innerHTML=`<tr><td colspan="6">Erreur de lecture : ${esc(error.message)}</td></tr>`;return;}
    allProducts=data||[]; $("statProducts").textContent=allProducts.filter(p=>p.actif).length;$("statLowStock").textContent=allProducts.filter(p=>Number(p.stock)<=5).length;
    const {data:cats}=await client.from("categories").select("id,nom").eq("actif",true).order("nom");
    $("pCategory").innerHTML='<option value="">Sans catégorie</option>'+(cats||[]).map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join("");
    renderProducts();
  }
  function renderProducts(){
    const q=($("productSearch")?.value||"").trim().toLocaleLowerCase("fr");
    const rows=allProducts.filter(p=>String(p.nom||"").toLocaleLowerCase("fr").includes(q));
    $("productCount").textContent=`${rows.length} produit(s)`;
    $("productsTable").innerHTML=rows.map(p=>`<tr>
      <td><strong>${esc(p.nom)}</strong><small class="slug">${esc(p.slug)}</small></td>
      <td>${money(p.prix_fcfa)}</td><td>${esc(p.unite)}</td>
      <td><span class="stock-pill ${Number(p.stock)<=5?"low":""}">${esc(p.stock)}</span></td>
      <td><span class="status ${p.actif?"active":"inactive"}">${p.actif?"Actif":"Inactif"}</span></td>
      <td><div class="actions"><button class="table-btn primary" data-edit="${esc(p.id)}">Modifier</button><button class="table-btn" data-toggle="${esc(p.id)}" data-active="${p.actif}">${p.actif?"Désactiver":"Activer"}</button></div></td>
    </tr>`).join("")||'<tr><td colspan="6" class="empty">Aucun produit trouvé.</td></tr>';
    $("productsTable").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
    $("productsTable").querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",async()=>{
      b.disabled=true;const {error}=await client.from("products").update({actif:b.dataset.active!=="true"}).eq("id",b.dataset.toggle);
      if(error){toast("Modification refusée : "+error.message);b.disabled=false;return;}toast("Statut du produit mis à jour.");await loadProducts();
    }));
  }
  async function editProduct(id){
    const p=allProducts.find(x=>String(x.id)===String(id));if(!p)return;
    const price=prompt(`Nouveau prix en FCFA pour « ${p.nom} » :`,String(p.prix_fcfa));if(price===null)return;
    const stock=prompt(`Nouveau stock disponible pour « ${p.nom} » :`,String(p.stock));if(stock===null)return;
    const priceNum=Number(price),stockNum=Number(stock);
    if(price.trim()===""||!Number.isFinite(priceNum)||priceNum<0||stock.trim()===""||!Number.isFinite(stockNum)||stockNum<0){toast("Prix et stock doivent être des nombres positifs.");return;}
    const {error}=await client.from("products").update({prix_fcfa:Math.round(priceNum),stock:stockNum}).eq("id",p.id);
    if(error){toast("Enregistrement refusé : "+error.message);return;}
    toast("Prix et stock enregistrés.");await loadProducts();
  }
  $("productSearch").addEventListener("input",renderProducts);
  async function loadOrders(){
    const {data,error}=await client.from("orders").select("id,numero,nom_client,total_fcfa,statut,created_at").order("created_at",{ascending:false}).limit(10);
    if(error){$("ordersTable").innerHTML=`<tr><td colspan="5">Commandes non accessibles : ${esc(error.message)}</td></tr>`;$("statOrders").textContent="—";return;}
    $("statOrders").textContent=(data||[]).length;
    $("ordersTable").innerHTML=(data||[]).map(o=>`<tr><td>${esc(o.numero||o.id)}</td><td>${esc(o.nom_client)}</td><td>${money(o.total_fcfa)}</td><td><span class="status">${esc(o.statut)}</span></td><td>${new Date(o.created_at).toLocaleDateString("fr-FR")}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">Aucune commande pour le moment.</td></tr>';
  }
  $("pName").addEventListener("input",()=>{if(!$("pSlug").dataset.touched)$("pSlug").value=$("pName").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");});
  $("pSlug").addEventListener("input",()=>{$("pSlug").dataset.touched="1";});
  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!client)return;const btn=e.submitter;btn.disabled=true;btn.textContent="Enregistrement…";
    const slug=$("pSlug").value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
    const item={nom:$("pName").value.trim(),slug,description:$("pDescription").value.trim()||null,categorie_id:$("pCategory").value?Number($("pCategory").value):null,prix_fcfa:Number($("pPrice").value),unite:$("pUnit").value,stock:Number($("pStock").value),image_url:$("pImage").value.trim()||null,actif:true};
    const {error}=await client.from("products").insert(item);
    btn.disabled=false;btn.textContent="＋ Enregistrer le produit";
    if(error){$("productMessage").textContent="Erreur : "+error.message;$("productMessage").className="message error";return;}
    $("productMessage").textContent="Produit enregistré avec succès.";$("productMessage").className="message success";$("productForm").reset();$("pStock").value="0";delete $("pSlug").dataset.touched;await loadProducts();toast("Produit ajouté.");
  });
  init();
})();