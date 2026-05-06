(function () {
  var path = window.location.pathname;
  if (path === '/login/' || path === '/login' || path.startsWith('/login/')) return;
  if (!localStorage.getItem('jsu_token')) {
    window.location.replace('/login/');
  }
})();

function jsuLogout() {
  localStorage.removeItem('jsu_token');
  window.location.replace('/login/');
}
