const LS_KEY = "gexp_items_v1";
let items = JSON.parse(localStorage.getItem(LS_KEY)) || [];

const $ = id => document.getElementById(id);
const grid = $("grid"), empty = $("empty");
const statTotal = $("statTotal"), statNear = $("statNear"), statExpired = $("statExpired"), statConsumed = $("statConsumed");

function daysBetween(dateStr){
  if(!dateStr) return Infinity;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((d - now) / (1000*60*60*24));
  return diff;
}

function classify(item){
  if(item.consumed) return "consumed";
  const days = daysBetween(item.expiryDate);
  if(isNaN(days)) return "unknown";
  if(days < 0) return "expired";
  if(days <= 7) return "near";
  return "safe";
}

function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function uid(){ return 'id'+Math.random().toString(36).slice(2,9); }

function render(){
  grid.innerHTML = "";
  const q = $("search").value.trim().toLowerCase();
  const filter = document.querySelector(".fbtn.active").dataset.filter;
  const sortMode = $("sort").value;

  let filtered = items.filter(it => {
    if(q && !(it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q))) return false;
    if(filter === "near") return classify(it) === "near";
    if(filter === "expired") return classify(it) === "expired";
    if(filter === "consumed") return it.consumed;
    return true;
  });

  if(sortMode === "soon") {
    filtered.sort((a,b) => daysBetween(a.expiryDate) - daysBetween(b.expiryDate));
  } else if(sortMode === "late"){
    filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if(sortMode === "name"){
    filtered.sort((a,b) => a.name.localeCompare(b.name));
  }

  if(filtered.length === 0) {
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
  }

  statTotal.textContent = items.length;
  statNear.textContent = items.filter(i => classify(i) === "near").length;
  statExpired.textContent = items.filter(i => classify(i) === "expired").length;
  statConsumed.textContent = items.filter(i => i.consumed).length;

  filtered.forEach(it => {
    const cls = classify(it);
    const card = document.createElement("div");
    card.className = "card item " + (cls === "safe" ? "safe" : cls === "near" ? "warn" : cls === "expired" ? "danger" : "");
    card.innerHTML = `
      <div class="meta">
        <div>
          <div class="title">${escapeHtml(it.name)}</div>
          <div class="cat">${escapeHtml(it.category)} • <span class="qty">${it.qty} pcs</span></div>
        </div>
        <div><div class="badge">${cls === 'expired' ? 'Expired' : cls === 'near' ? 'Near' : cls === 'safe' ? 'Safe' : it.consumed ? 'Consumed' : 'Unknown'}</div></div>
      </div>
      <div class="dates">
        <div>Purchased: ${it.purchaseDate || '—'}</div>
        <div>Expiry: ${it.expiryDate || '—'}</div>
        <div>${daysLeftText(it.expiryDate)}</div>
      </div>
      <div class="actions">
        <button class="btn-consume">${it.consumed ? 'Mark Undone' : 'Mark Consumed'}</button>
        <button class="btn-edit">Edit</button>
        <button class="btn-del">Delete</button>
      </div>
    `;

    const [btnConsume, btnEdit, btnDel] = card.querySelectorAll("button");
    btnConsume.addEventListener("click", () => {
      it.consumed = !it.consumed;
      save(); render();
    });
    btnDel.addEventListener("click", () => {
      if(confirm(`Delete "${it.name}"?`)){
        items = items.filter(x => x.id !== it.id);
        save(); render();
      }
    });
    btnEdit.addEventListener("click", () => openEditor(it));
    grid.appendChild(card);
  });
}

function daysLeftText(edate){
  if(!edate) return "";
  const d = daysBetween(edate);
  if(d < 0) return `${Math.abs(d)} day(s) overdue`;
  if(d === 0) return `Expires today`;
  return `${d} day(s) left`;
}

function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

$("addBtn").addEventListener("click", ()=> {
  const name = $("name").value.trim();
  const qty = parseInt($("qty").value) || 1;
  const cat = $("category").value || "Other";
  const pdate = $("pdate").value || "";
  const edate = $("edate").value || "";
  if(!name){ alert("Please enter item name"); return; }
  const it = { id: uid(), name, qty, category:cat, purchaseDate:pdate, expiryDate:edate, consumed:false, createdAt: new Date().toISOString() };
  items.push(it);
  save();
  $("name").value = ""; $("qty").value=""; $("pdate").value=""; $("edate").value="";
  notifyIfNear(it);
  render();
});

$("search").addEventListener("input", render);
$("sort").addEventListener("change", render);
document.querySelectorAll(".fbtn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".fbtn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); render();
  });
});

$("exportCSV").addEventListener("click", () => {
  if(items.length === 0){ alert("No items to export."); return; }
  const rows = [["name","qty","category","purchaseDate","expiryDate","consumed"]];
  items.forEach(it => rows.push([it.name, it.qty, it.category, it.purchaseDate, it.expiryDate, it.consumed]));
  const csv = rows.map(r => r.map(cell => `"${(cell+'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "grocery_inventory.csv"; a.click();
  URL.revokeObjectURL(url);
});

function openEditor(it){
  const newName = prompt("Item name:", it.name);
  if(newName === null) return;
  const newQty = prompt("Quantity:", it.qty);
  if(newQty === null) return;
  const newCat = prompt("Category:", it.category);
  if(newCat === null) return;
  const newP = prompt("Purchase date (YYYY-MM-DD):", it.purchaseDate || "");
  if(newP === null) return;
  const newE = prompt("Expiry date (YYYY-MM-DD):", it.expiryDate || "");
  if(newE === null) return;
  it.name = newName.trim() || it.name;
  it.qty = parseInt(newQty) || it.qty;
  it.category = newCat || it.category;
  it.purchaseDate = newP || "";
  it.expiryDate = newE || "";
  save(); render();
}

function notifyIfNear(it){
  const d = daysBetween(it.expiryDate);
  if(!isFinite(d)) return;
  if(d <= 7 && d >= 0){
    toast(`"${it.name}" expires in ${d} day(s) — consider using soon.`);
    if("Notification" in window && Notification.permission === "granted"){
      new Notification("Expiry reminder", { body: `${it.name} expires in ${d} day(s)` });
    } else if("Notification" in window && Notification.permission !== "denied"){
      Notification.requestPermission().then(p => {
        if(p === "granted") new Notification("Expiry reminder", { body: `${it.name} expires in ${d} day(s)` });
      });
    }
  }
}

function toast(msg){
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', right:'18px', bottom:'18px', background:'#0d6e6e', color:'#fff', padding:'12px 14px', borderRadius:'10px', boxShadow:'0 8px 20px rgba(0,0,0,.15)', zIndex:9999 });
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = 0.02, 3000);
  setTimeout(()=> t.remove(), 3800);
}

render();

if("Notification" in window && Notification.permission === "default"){
  setTimeout(()=> {
    try{ Notification.requestPermission(); }catch(e){}
  }, 2000);
}
