const fs = require('fs');
let html = fs.readFileSync('src/app/pages/dashboard/dashboard-demo.component.html', 'utf8');

// 1. Fix onclicks
html = html.replace(/onclick="showPage\('([^']+)'\)"/g, `(click)="showPage('$1')"`);
html = html.replace(/onclick="updateChart\(this,'([^']+)'\)"/g, `(click)="updateChart('$1')"`);
html = html.replace(/onclick="openModal\(\)"/g, `(click)="openModal()"`);
html = html.replace(/onclick="closeModal\(event\)"/g, `(click)="closeModal($event)"`);
html = html.replace(/onclick="closeModal\(\)"/g, `(click)="closeModal()"`);

// 2. Fix page displays
const pages = ['dashboard', 'income', 'taxas', 'cs2', 'comunidade', 'rendas', 'simulador', 'perfil'];
pages.forEach(p => {
  if (p === 'dashboard') {
    html = html.replace(/<div id="page-dashboard">/, `<div id="page-dashboard" *ngIf="currentPage === 'dashboard'">`);
  } else {
    html = html.replace(new RegExp('<div id="page-' + p + '" style="display:none">'), `<div id="page-${p}" *ngIf="currentPage === '${p}'">`);
  }
});

// 3. Fix nav active classes
html = html.replace(/class="nav-item active" \(click\)="showPage\('dashboard'\)"/, `class="nav-item" [class.active]="currentPage === 'dashboard'" (click)="showPage('dashboard')"`);
html = html.replace(/class="nav-item" \(click\)="showPage\('([^']+)'\)"/g, `class="nav-item" [class.active]="currentPage === '$1'" (click)="showPage('$1')"`);

// 4. Fix topbar titles
html = html.replace(/<div class="topbar-title" id="topbar-title">Dashboard<\/div>/, `<div class="topbar-title" id="topbar-title">{{ titles[currentPage][0] }}</div>`);
html = html.replace(/<div class="topbar-sub" id="topbar-sub">Domingo, 10 de Maio · Euribor 6M: 2.61% ↓<\/div>/, `<div class="topbar-sub" id="topbar-sub">{{ titles[currentPage][1] }}</div>`);

// 5. Fix chart active period tabs
html = html.replace(/<button class="period-tab active" \(click\)="updateChart\('6m'\)">6M<\/button>/, `<button class="period-tab" [class.active]="currentChartPeriod === '6m'" (click)="updateChart('6m')">6M</button>`);
html = html.replace(/<button class="period-tab" \(click\)="updateChart\('([^']+)'\)">([^<]+)<\/button>/g, `<button class="period-tab" [class.active]="currentChartPeriod === '$1'" (click)="updateChart('$1')">$2</button>`);

// 6. Remove <script> block
html = html.replace(/<script>[\s\S]*?<\/script>/, '');

// 7. Fix modal display
html = html.replace(/<div class="modal-overlay" id="modal" \(click\)="closeModal\(\$event\)">/, `<div class="modal-overlay" id="modal" [class.open]="modalOpen" (click)="closeModal($event)">`);

// 8. Remove duplicated Row 3 & 4
const row3Str = `        <!-- ROW 3: ALLOC + GOALS + FIRE -->`;
const firstRow3 = html.indexOf(row3Str);
const secondRow3 = html.indexOf(row3Str, firstRow3 + 1);
if (secondRow3 > -1) {
    const endOfDup = html.indexOf(`      </div><!-- /dashboard -->`, secondRow3);
    if (endOfDup > -1) {
        html = html.substring(0, secondRow3) + html.substring(endOfDup);
    }
}

fs.writeFileSync('src/app/pages/dashboard/dashboard-demo.component.html', html);
