
document.querySelectorAll('[data-search]').forEach(el=>{
  el.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('.product-card,.poster,.feature,.match-row,.trow').forEach(card=>{
      card.style.display=card.textContent.toLowerCase().includes(q)?'':'none';
    });
  });
});
document.querySelectorAll('.btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(btn.textContent.trim()==='Export') alert('Export action is ready for backend wiring.');
  });
});
