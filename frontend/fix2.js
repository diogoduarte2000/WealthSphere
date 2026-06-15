const fs = require('fs');
let html = fs.readFileSync('src/app/pages/dashboard/dashboard-demo.component.html', 'utf8');

const pages = ['dashboard', 'income', 'taxas', 'cs2', 'comunidade', 'rendas', 'simulador', 'perfil'];
pages.forEach(p => {
  const target = `<div id="page-${p}" *ngIf="currentPage === '${p}'">`;
  const replacement = `<div id="page-${p}" [style.display]="currentPage === '${p}' ? 'block' : 'none'">`;
  html = html.replace(target, replacement);
});

fs.writeFileSync('src/app/pages/dashboard/dashboard-demo.component.html', html);
