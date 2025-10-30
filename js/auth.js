/* Deporte Conecta · Auth (demo local) */

document.addEventListener('DOMContentLoaded', () => {
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');

  btnLogin?.addEventListener('click', onLogin);
  btnRegister?.addEventListener('click', onRegister);
});

async function onLogin(){
  const ident = document.getElementById('loginId').value.trim();
  const pass  = document.getElementById('loginPass').value;

  if(!ident || !pass){
    alert('Completa usuario/email y contraseña.');
    return;
  }

  const user = DS.getUserByUsernameOrEmail(ident);
  if(!user){
    alert('Usuario o email no encontrado.');
    return;
  }

  const ok = await DS.verifyPassword(user, pass);
  if(!ok){
    alert('Contraseña incorrecta.');
    return;
  }

  DS.setSession(user.id);
  alert(`¡Bienvenido, ${user.name || user.username}!`);
  location.href = 'index.html'; // ← ahora va a la zona principal
}

async function onRegister(){
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pass     = document.getElementById('regPass').value;
  const pass2    = document.getElementById('regPass2').value;
  const name     = document.getElementById('regName').value.trim();

  if(!username || !email || !pass || !pass2){
    alert('Completa todos los campos.');
    return;
  }
  if(pass.length < 6){ alert('La contraseña debe tener al menos 6 caracteres.'); return; }
  if(pass !== pass2){ alert('Las contraseñas no coinciden.'); return; }

  try{
    const user = await DS.createUser({ username, email, password: pass, name });
    DS.setSession(user.id);
    alert('Cuenta creada con éxito. Sesión iniciada.');
    location.href = 'index.html'; // ← ahora va a la zona principal
  }catch(err){
    alert(err.message || 'No fue posible crear la cuenta.');
  }
}
