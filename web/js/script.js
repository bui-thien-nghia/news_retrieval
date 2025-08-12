// Setting color
    const open = document.getElementById('btn-open');
    const close = document.getElementById('btn-close');
 
    const modal_container = document.getElementById('modal-container');
    const modal_demo = document.getElementById('modal-demo');
        
    const saving = document.getElementById('sub_btn');
        
    open.addEventListener('click', ()=>{
        modal_container.classList.add('show');
    });
    close.addEventListener('click', ()=>{
        modal_container.classList.remove('show');
    });

    modal_container.addEventListener('click', (e)=>{
        if(!modal_demo.contains(e.target)){
        close.click();
        }
    });
            
    saving.addEventListener('click', ()=>{
        const color_val = document.getElementById('mau').value;
        document.body.style.backgroundColor = color_val;
    });
