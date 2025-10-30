/* Deporte Conecta · DataService (demo localStorage)
   - Usuarios
   - Sesión
   - Utilidades (hash)
*/
(function(){
  const KEYS = {
    USERS: 'dc_users',
    SESSION: 'dc_session'
  };

  // ===== Helpers =====
  function readLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
  function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

  // UUID (fallback si no hay crypto.randomUUID)
  function uuid(){ return (crypto?.randomUUID?.()) || (Date.now().toString(16) + Math.random().toString(16).slice(2)); }

  // Hash simple con SHA-256 (salt + password)
  async function sha256(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ===== Usuarios =====
  function listUsers(){ return readLS(KEYS.USERS, []); }
  function getUserById(id){ return listUsers().find(u => u.id === id) || null; }
  function getUserByUsernameOrEmail(ident){
    const v = String(ident).trim().toLowerCase();
    return listUsers().find(u => u.username.toLowerCase() === v || u.email.toLowerCase() === v) || null;
    }
  function usernameExists(username){
    const v = String(username).trim().toLowerCase();
    return listUsers().some(u => u.username.toLowerCase() === v);
  }
  function emailExists(email){
    const v = String(email).trim().toLowerCase();
    return listUsers().some(u => u.email.toLowerCase() === v);
  }

  async function createUser({username, email, password, name}){
    username = String(username||'').trim();
    email = String(email||'').trim();
    if(!username || !email || !password) throw new Error('Campos obligatorios faltantes');

    if(usernameExists(username)) throw new Error('El usuario ya existe');
    if(emailExists(email)) throw new Error('El email ya está registrado');

    const salt = uuid();
    const passHash = await sha256(salt + ':' + password);

    const user = {
      id: uuid(),
      username,
      email,
      passHash,
      salt,
      name: name?.trim() || username,
      avatar: '',
      bio: '',
      sportsFav: [],
      city: '',
      createdAt: Date.now()
    };

    const users = listUsers();
    users.push(user);
    saveLS(KEYS.USERS, users);
    return user;
  }

  async function verifyPassword(user, password){
    const check = await sha256(user.salt + ':' + password);
    return check === user.passHash;
  }

  async function updateUser(id, patch){
    const users = listUsers();
    const i = users.findIndex(u => u.id === id);
    if(i < 0) throw new Error('Usuario no encontrado');

    // email/username únicos si cambian
    if(patch.username && patch.username !== users[i].username){
      if(usernameExists(patch.username)) throw new Error('El usuario ya existe');
    }
    if(patch.email && patch.email !== users[i].email){
      if(emailExists(patch.email)) throw new Error('El email ya está registrado');
    }

    users[i] = { ...users[i], ...patch };
    saveLS(KEYS.USERS, users);
    return users[i];
  }

  // ===== Sesión =====
  function getSession(){ return readLS(KEYS.SESSION, null); }
  function getSessionUserId(){ return getSession()?.userId || null; }
  function isLoggedIn(){ return !!getSessionUserId(); }
  function setSession(userId){ saveLS(KEYS.SESSION, { userId, ts: Date.now() }); }
  function clearSession(){ localStorage.removeItem(KEYS.SESSION); }

  // Exponer en window
  window.DS = {
    // users
    listUsers, getUserById, getUserByUsernameOrEmail,
    createUser, updateUser, verifyPassword,
    // session
    getSession, getSessionUserId, isLoggedIn, setSession, clearSession,
    // utils
    sha256
  };
})();
