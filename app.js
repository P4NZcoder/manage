/* =========================================================================
   PAYROLL APP — app.js  (Facebook iOS Edition)
   Facebook-style layout | Stories attendance | Reaction status buttons
========================================================================= */

const CFG = {
  company:'', workDays:26, workHours:8, payDay:15,
  ot:{ normal:1.5, holiday:3.0 }, lateDeduct:5, lateThreshold:15,
  leaveQuota:{ sick:30, personal:3, annual:6 },
  taxBrackets:[
    {limit:150000,rate:0.00},{limit:300000,rate:0.05},{limit:500000,rate:0.10},
    {limit:750000,rate:0.15},{limit:1000000,rate:0.20},{limit:Infinity,rate:0.25},
  ]
};

/* ======= UTILS ======= */
const TH_MONTHS_S=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_MONTHS_F=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DAYS_S=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const TH_WEEKDAYS=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const z2=n=>String(n).padStart(2,'0');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const daysInMonth=(m,y)=>new Date(y,m,0).getDate();
const firstDOW=(m,y)=>new Date(y,m-1,1).getDay();
const todayKey=()=>fmt.dateKey(new Date());
const initials=n=>{ const p=n.split(' '); return p.length>1?p[0][0]+p[1][0]:n.slice(0,2); };

const fmt={
  money:   n=>(n||0).toLocaleString('th-TH')+'&thinsp;฿',
  moneyK:  n=>n>=1e6?(n/1e6).toFixed(1)+'M฿':n>=1e3?(n/1e3).toFixed(0)+'K฿':(n||0)+'฿',
  date:    d=>{ const t=new Date(d); return `${t.getDate()} ${TH_MONTHS_S[t.getMonth()]} ${t.getFullYear()+543}`; },
  monthY:  (m,y)=>`${TH_MONTHS_F[m-1]} ${y+543}`,
  dateKey: d=>{ const t=new Date(d); return `${t.getFullYear()}-${z2(t.getMonth()+1)}-${z2(t.getDate())}`; },
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzYEDQ4tYL57cHlGsaxowky5Ue28wqsxPeDCu7YjuwaaCIKi4CCepK4V23CGVfPlXsBiw/exec';

function syncToCloud() {
  if (!GAS_URL) return;
  const fullData = { emp: DB.getEmployees(), att: DB.getAttendance(), draws: DB.getDraws() };
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'SAVE', payload: fullData })
  }).catch(e => console.error('Cloud save failed:', e));
}

async function cloudLoad() {
  if (!GAS_URL) return false;
  try {
    const res = await fetch(GAS_URL + '?action=LOAD');
    const txt = await res.text();
    if(!txt || txt.includes("พร้อมใช้งาน")) return false;
    const data = JSON.parse(txt);
    if (data && data.emp && data.emp.length > 0) {
      DB.saveEmployees(data.emp);
      if(data.att) DB.saveAttendance(data.att);
      if(data.draws) DB.saveDraws(data.draws);
      DB.setInit();
      return true;
    }
  } catch(e) { console.error('Load failed:', e); }
  return false;
}

/* ======= DATABASE ======= */
const DB={
  KEY:'pr_fb_',
  read(k){try{return JSON.parse(localStorage.getItem(this.KEY+k))||[];}catch{return[];}},
  write(k,v){localStorage.setItem(this.KEY+k,JSON.stringify(v));},
  inited(){return!!localStorage.getItem(this.KEY+'init');},
  setInit(){localStorage.setItem(this.KEY+'init','1');},
  getEmployees(){return this.read('emp');},
  getEmployee(id){return this.getEmployees().find(e=>e.id===id);},
  saveEmployees(l){this.write('emp',l);},
  addEmployee(d){const l=this.getEmployees();const e={...d,id:'EMP'+Date.now(),status:'active',leave_quota:CFG.leaveQuota};l.push(e);this.saveEmployees(l);syncToCloud('ADD_EMP', e);return e;},
  updateEmployee(id,d){this.saveEmployees(this.getEmployees().map(e=>e.id===id?{...e,...d}:e));syncToCloud('UPDATE_EMP', {id,...d});},
  deleteEmployee(id){this.saveEmployees(this.getEmployees().filter(e=>e.id!==id));syncToCloud('DEL_EMP', {id});},
  getAttendance(){return this.read('att');},
  saveAttendance(l){this.write('att',l);},
  getAttByDate(date){return this.getAttendance().filter(r=>r.date===date);},
  getAttByEmp(id,m,y){const p=`${y}-${z2(m)}`;return this.getAttendance().filter(r=>r.employee_id===id&&r.date.startsWith(p));},
  getAttRec(empId,date){return this.getAttendance().find(r=>r.employee_id===empId&&r.date===date);},
  setAttRec(empId,date,data){
    let l=this.getAttendance();
    const i=l.findIndex(r=>r.employee_id===empId&&r.date===date);
    const rec={id:uid(),...data,employee_id:empId,date};
    if(i>=0)l[i]={...l[i],...rec};else l.push(rec);
    this.saveAttendance(l);
    syncToCloud('ATTENDANCE', rec);
  },
  getDraws(){return this.read('draws');},
  saveDraws(l){this.write('draws',l);},
  getDraw(id){return this.getDraws().find(e=>e.id===id);},
  addDraw(d){const l=this.getDraws();const e={...d,id:'DRW'+Date.now(),created_at:new Date().toISOString()};l.push(e);this.saveDraws(l);syncToCloud('DRAW', e);return e;},
  deleteDraw(id){this.saveDraws(this.getDraws().filter(e=>e.id!==id));syncToCloud('DEL_DRAW', {id});},
  getDrawByEmp(id,m,y){const p=`${y}-${z2(m)}`;return this.getDraws().filter(e=>e.employee_id===id&&e.date.startsWith(p));},
};

/* ======= SEED DATA ======= */
function seedData(){
  if(DB.inited())return;
  DB.saveEmployees([
    {id:'EMP001',name:'สมชาย มานะดี',   department:'การตลาด',      position:'ผู้จัดการฝ่ายการตลาด', base_salary:45000,allowance_diligent:2000,loan_monthly:0,   phone:'081-234-5678',bank_account:'123-4-56789-0',avatar_color:'#6C47FF',status:'active',leave_quota:CFG.leaveQuota,start_date:'2022-03-01'},
    {id:'EMP002',name:'วิไล สุขสันต์',   department:'ทรัพยากรบุคคล',position:'ผู้จัดการ HR',         base_salary:38000,allowance_diligent:1500,loan_monthly:3000,phone:'082-345-6789',bank_account:'234-5-67890-1',avatar_color:'#E1306C',status:'active',leave_quota:CFG.leaveQuota,start_date:'2021-06-15'},
    {id:'EMP003',name:'ธนัช รุ่งโรจน์',  department:'เทคโนโลยี',    position:'นักพัฒนาซอฟต์แวร์',  base_salary:42000,allowance_diligent:0,  loan_monthly:5000,phone:'083-456-7890',bank_account:'345-6-78901-2',avatar_color:'#0866FF',status:'active',leave_quota:CFG.leaveQuota,start_date:'2023-01-10'},
    {id:'EMP004',name:'มาลี วงค์ดี',     department:'บัญชี',         position:'นักบัญชีอาวุโส',      base_salary:32000,allowance_diligent:1000,loan_monthly:0,   phone:'084-567-8901',bank_account:'456-7-89012-3',avatar_color:'#42B72A',status:'active',leave_quota:CFG.leaveQuota,start_date:'2020-09-01'},
    {id:'EMP005',name:'ปริม แก้วสวย',    department:'การตลาด',      position:'เจ้าหน้าที่การตลาด',  base_salary:28000,allowance_diligent:1000,loan_monthly:0,   phone:'085-678-9012',bank_account:'567-8-90123-4',avatar_color:'#F7B928',status:'active',leave_quota:CFG.leaveQuota,start_date:'2024-02-01'},
  ]);
  const aMap={
    EMP001:{1:'present',2:'present',3:'present',4:'holiday',5:'holiday',6:'present',7:'present',8:'present',9:'present',10:'present',11:'holiday',12:'holiday',13:'present',14:'present',15:'present',16:'present'},
    EMP002:{1:'present',2:'late',3:'present',4:'holiday',5:'holiday',6:'sick_leave',7:'sick_leave',8:'present',9:'present',10:'present',11:'holiday',12:'holiday',13:'present',14:'late',15:'present',16:'present'},
    EMP003:{1:'present',2:'present',3:'absent',4:'holiday',5:'holiday',6:'present',7:'present',8:'present',9:'personal_leave',10:'present',11:'holiday',12:'holiday',13:'present',14:'present',15:'present',16:'present'},
    EMP004:{1:'present',2:'present',3:'present',4:'holiday',5:'holiday',6:'present',7:'annual_leave',8:'annual_leave',9:'present',10:'present',11:'holiday',12:'holiday',13:'present',14:'present',15:'present',16:'present'},
    EMP005:{1:'present',2:'present',3:'present',4:'holiday',5:'holiday',6:'late',7:'present',8:'present',9:'present',10:'present',11:'holiday',12:'holiday',13:'present',14:'present',15:'present',16:'late'},
  };
  const al=[];
  Object.entries(aMap).forEach(([id,days])=>{
    Object.entries(days).forEach(([d,s])=>{
      const date=`2026-07-${z2(Number(d))}`;
      const lm=s==='late'?(Math.floor(Math.random()*25)+10):0;
      const rec={id:uid(),employee_id:id,date,status:s,late_minutes:lm,ot_hours:0,ot_type:null,note:''};
      if(id==='EMP001'&&[8,15].includes(Number(d))){rec.ot_hours=2;rec.ot_type='normal';}
      if(id==='EMP003'&&Number(d)===12){rec.ot_hours=4;rec.ot_type='holiday';}
      if(id==='EMP005'&&Number(d)===14){rec.ot_hours=1.5;rec.ot_type='normal';}
      al.push(rec);
    });
  });
  DB.saveAttendance(al);
  DB.saveDraws([
    {id:'DRW001',employee_id:'EMP001',date:'2026-07-08',amount:500,created_at:'2026-07-08T18:00:00'},
    {id:'DRW002',employee_id:'EMP002',date:'2026-07-10',amount:300,created_at:'2026-07-10T18:00:00'}
  ]);
  DB.setInit();
}

/* ======= STATE ======= */
const currDt=new Date();
const S={
  page:'attendance',prevPage:null,
  att:{mode:'daily',date:todayKey(),empId:null,month:currDt.getMonth()+1,year:currDt.getFullYear()},
  exp:{filter:'all'},
  pay:{month:currDt.getMonth()+1,year:currDt.getFullYear(),cycle:currDt.getDate()>15?2:1},
  emp:{search:'',selectedId:null},
};


/* ======= CALCULATOR ======= */
const Calc={
  daily: s=>s/30,
  hourly:s=>(s/30)/CFG.workHours,
  otAmt(s,h,t){if(!h)return 0;return this.hourly(s)*(t==='holiday'?CFG.ot.holiday:CFG.ot.normal)*h;},
  tax(annual){const taxable=Math.max(0,annual-60000);let tax=0,prev=0;for(const b of CFG.taxBrackets){if(taxable<=prev)break;tax+=(Math.min(taxable,b.limit)-prev)*b.rate;prev=b.limit;}return tax;},
  monthlyTax(s){return Math.round(this.tax(s*12)/12);},
  summary(id,m,y){
    const recs=DB.getAttByEmp(id,m,y);
    const r={present:0,late:0,absent:0,sick:0,personal:0,annual:0,otNorm:0,otHol:0,lateMin:0};
    recs.forEach(rec=>{
      switch(rec.status){
        case'present':r.present++;break;case'late':r.late++;r.lateMin+=(rec.late_minutes||0);break;
        case'absent':r.absent++;break;case'sick_leave':r.sick++;break;
        case'personal_leave':r.personal++;break;case'annual_leave':r.annual++;break;
      }
      if(rec.ot_type==='normal')r.otNorm+=(rec.ot_hours||0);
      if(rec.ot_type==='holiday')r.otHol+=(rec.ot_hours||0);
    });
    r.otTotal=r.otNorm+r.otHol; return r;
  },
  earnedSoFar(id, m, y, upToDate) {
    const emp = DB.getEmployee(id);
    if(!emp) return {days:0, earned:0, advance:0, draws:0, max:0, cycle:1};
    const daily = this.daily(emp.base_salary);
    const dayOfMonth = parseInt(upToDate.split('-')[2]);
    const cycle = (dayOfMonth > CFG.payDay) ? 2 : 1;
    const startDay = cycle === 2 ? CFG.payDay + 1 : 1;
    const endDay = dayOfMonth;
    
    const recs = DB.getAttByEmp(id,m,y);
    let days = 0;
    recs.forEach(r => {
      const d = parseInt(r.date.split('-')[2]);
      if (d >= startDay && d <= endDay && (r.status === 'present' || r.status === 'late')) days++;
    });
    const earned = Math.floor(days * daily);
    const drawsList = DB.getDrawByEmp(id,m,y).filter(d => {
      const dd = parseInt(d.date.split('-')[2]);
      return dd >= startDay && dd <= endDay;
    });
    const totalDraws = drawsList.reduce((a,d) => a + d.amount, 0);
    const max = Math.max(0, earned - totalDraws);
    return { days, earned, advance: 0, draws: totalDraws, max, cycle };
  },
  payslip(id,m,y,cycle){
    const emp=DB.getEmployee(id); if(!emp) return null;
    const dailyWage = Math.round(emp.base_salary/30);
    const dInM = daysInMonth(m, y);
    const s = dailyWage * dInM;
    const adv = dailyWage * 15;
    const rem = s - adv;
    
    if(cycle===1) return {emp,cycle,month:m,year:y,salary_base:s,advance:adv,net_pay:adv};
    
    const att=this.summary(id,m,y);
    const draws=DB.getDrawByEmp(id,m,y);
    const drawT=draws.reduce((a,d)=>a+d.amount,0);
    const otN=Math.round(this.otAmt(emp.base_salary,att.otNorm,'normal'));
    const otH=Math.round(this.otAmt(emp.base_salary,att.otHol,'holiday'));
    const otT=otN+otH;
    const dili=(att.absent===0&&att.late===0)?(emp.allowance_diligent||0):0;
    const gross=rem+otT+dili;
    const tax=0;
    const absD=Math.round(dailyWage*att.absent);
    const latD=Math.round(att.lateMin*CFG.lateDeduct);
    const loan=emp.loan_monthly||0;
    const totD=absD+latD+loan+drawT;
    
    return{emp,cycle,month:m,year:y,salary_base:s,advance_paid:adv,salary_rem:rem,
      ot_norm:otN,ot_hol:otH,ot_total:otT,ot_norm_h:att.otNorm,ot_hol_h:att.otHol,
      diligent:dili,draw_total:drawT,draws:draws,gross,
      tax_deduct:tax,abs_deduct:absD,absent_days:att.absent,
      late_deduct:latD,late_min:att.lateMin,loan_deduct:loan,
      total_deduct:totD,net_pay:Math.max(0,gross-totD),att};
  }
};

/* ======= NAVIGATION ======= */
function navigate(page){S.prevPage=S.page;S.page=page;renderPage(page);}
function goBack(){navigate(S.prevPage||'dashboard');}

function renderPage(page){
  const $c=document.getElementById('content');
  const $title=document.getElementById('topbar-title');
  const $back=document.getElementById('btn-back');
  const $act=document.getElementById('btn-action');

  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));



  $back.style.visibility='hidden';$act.style.visibility='hidden';$act.onclick=null;
  const titles={dashboard:'หน้าหลัก',attendance:'เช็คชื่อพนักงาน',expense:'ใบเบิก / ลงบิล',payroll:'ประมวลผลเงินเดือน',employees:'รายชื่อพนักงาน','emp-detail':'ข้อมูลพนักงาน',menu:'เมนู'};
  $title.textContent=titles[page]||page;

  switch(page){
    case'dashboard':  $c.innerHTML=renderDashboard(); break;
    case'attendance': $c.innerHTML=S.att.mode==='daily'?renderDailyAtt():renderMonthlyAtt(); break;

    case'payroll':    $c.innerHTML=renderPayroll(); break;
    case'menu':       $c.innerHTML=renderMenu(); break;
    case'employees':
      $act.style.visibility='visible';
      $act.querySelector('i').className='fas fa-user-plus';
      $act.onclick=()=>showEmpModal(null);
      $c.innerHTML=renderEmployees(); break;
    case'emp-detail':
      $back.style.visibility='visible';
      $c.innerHTML=renderEmpDetail(S.emp.selectedId); break;
  }
  $c.classList.remove('fade-in'); void $c.offsetWidth; $c.classList.add('fade-in');
  $c.scrollTop=0; bindEvents();
}

/* ======= RENDER: DASHBOARD ======= */
function renderDashboard(){
  const now=new Date();
  const day=now.getDate(),m=now.getMonth()+1,y=now.getFullYear();
  const emps=DB.getEmployees().filter(e=>e.status==='active');
  const totalSal=emps.reduce((s,e)=>s+e.base_salary,0);
  const todayRecs=DB.getAttByDate(todayKey());
  const cnts={
    present:todayRecs.filter(r=>r.status==='present').length,
    late:   todayRecs.filter(r=>r.status==='late').length,
    absent: todayRecs.filter(r=>r.status==='absent').length,
    leave:  todayRecs.filter(r=>['sick_leave','personal_leave','annual_leave'].includes(r.status)).length,
  };
  const isAfter15=day>CFG.payDay;
  const nextDate=isAfter15?daysInMonth(m,y):CFG.payDay;
  const daysLeft=nextDate-day;
  const cycleNum=isAfter15?2:1;

  // Stories: attendance status ring per employee
  const storiesHtml=emps.map(emp=>{
    const rec=DB.getAttRec(emp.id,todayKey());
    const st=rec?.status||'none';
    const srClass=`sr-${st.replace('_leave','')||'none'}`;
    const stLbl={present:'✅ มาแล้ว',late:'⏰ มาสาย',absent:'❌ ขาด',sick_leave:'🏥 ลาป่วย',personal_leave:'📝 ลากิจ',annual_leave:'🏖️ พักร้อน',holiday:'🎌 หยุด',none:'ยังไม่บันทึก'}[st]||st;
    return `
    <div class="story-item" onclick="navigate('attendance')">
      <div class="story-ring ${srClass}">
        <div class="story-inner" style="background:${emp.avatar_color}">${emp.emoji||initials(emp.name)}</div>
      </div>
      <span class="story-name">${emp.name.split(' ')[0]}</span>
      <span class="story-status-label" style="color:${stColor(st)};font-size:9px">${stLbl.split(' ').slice(-1)[0]||''}</span>
    </div>`;
  }).join('');

  return `
  <!-- Greeting -->
  <div style="padding:16px 16px 8px; display:flex; justify-content:space-between; align-items:flex-end;">
    <div>
      <div class="dash-welcome" style="font-size:22px;font-weight:900;letter-spacing:-0.02em;color:var(--t1)">วัน${TH_WEEKDAYS[now.getDay()]} ${day} ${TH_MONTHS_S[m-1]} ${y+543}</div>
      <div class="dash-company" style="font-size:14px;color:var(--t2);font-weight:600;margin-top:2px">${CFG.company}</div>
    </div>
    <button class="btn" style="padding:8px 16px;border-radius:var(--r-lg);background:var(--blue)15;color:var(--blue);font-weight:bold;border:none;box-shadow:none;" onclick="showSharedQR()">
      <i class="fas fa-qrcode"></i> QR ลงเวลา
    </button>
  </div>

  <!-- Today stat bar -->
  <div style="padding:0 16px 16px">
    <div style="display:flex;gap:0;background:var(--surface);border-radius:var(--r-xl);box-shadow:0 4px 16px rgba(0,0,0,.04);overflow:hidden;border:1px solid var(--border)">
      <div class="att-stat-item" onclick="navigate('attendance')" style="flex:1;padding:16px 4px;text-align:center;border-right:1px solid var(--border)">
        <div class="att-stat-num" style="color:var(--green);font-size:24px;font-weight:900;letter-spacing:-0.02em">${cnts.present}</div>
        <div class="att-stat-lbl" style="font-size:12px;margin-top:4px;color:var(--t2);font-weight:600">มาทำงาน</div>
      </div>
      <div class="att-stat-item" onclick="navigate('attendance')" style="flex:1;padding:16px 4px;text-align:center;border-right:1px solid var(--border)">
        <div class="att-stat-num" style="color:var(--yellow);font-size:24px;font-weight:900;letter-spacing:-0.02em">${cnts.late}</div>
        <div class="att-stat-lbl" style="font-size:12px;margin-top:4px;color:var(--t2);font-weight:600">มาสาย</div>
      </div>
      <div class="att-stat-item" onclick="navigate('attendance')" style="flex:1;padding:16px 4px;text-align:center;border-right:1px solid var(--border)">
        <div class="att-stat-num" style="color:var(--red);font-size:24px;font-weight:900;letter-spacing:-0.02em">${cnts.absent}</div>
        <div class="att-stat-lbl" style="font-size:12px;margin-top:4px;color:var(--t2);font-weight:600">ขาดงาน</div>
      </div>
      <div class="att-stat-item" onclick="navigate('attendance')" style="flex:1;padding:16px 4px;text-align:center">
        <div class="att-stat-num" style="color:var(--t3);font-size:24px;font-weight:900;letter-spacing:-0.02em">${emps.length-cnts.present-cnts.late-cnts.absent-cnts.leave}</div>
        <div class="att-stat-lbl" style="font-size:12px;margin-top:4px;color:var(--t2);font-weight:600">ยังไม่บันทึก</div>
      </div>
    </div>
  </div>

  <!-- Countdown Card -->
  <div class="fb-section" style="padding:12px 16px">
    <div class="countdown-card">
      <div class="cd-label"><i class="fas fa-calendar-alt"></i> ${isAfter15?'จ่ายสิ้นเดือน':'จ่ายวันที่ 15'} ${TH_MONTHS_S[m-1]} ${y+543}</div>
      <div class="cd-sub">รอบจ่ายเงินที่ ${cycleNum} กำลังจะถึง</div>
      <div class="cd-row">
        <div>
          <div class="cd-num">${daysLeft}</div>
          <div class="cd-unit">วัน</div>
        </div>
        <div class="cycle-badges">
          <div class="cycle-badge ${cycleNum===1?'active-cycle':''}" onclick="navigate('payroll');setTimeout(()=>setPayCycle(1),80)">
            <div class="cy-date">15</div><div class="cy-label">รอบ 1</div>
          </div>
          <div class="cycle-badge ${cycleNum===2?'active-cycle':''}" onclick="navigate('payroll');setTimeout(()=>setPayCycle(2),80)">
            <div class="cy-date">${daysInMonth(m,y)}</div><div class="cy-label">รอบ 2</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Stories: Today's attendance -->
  <div class="fb-section">
    <div class="fb-section-header">
      <div class="fb-section-title">การเข้างานวันนี้</div>
      <button class="fb-section-action" onclick="navigate('attendance')">จัดการ</button>
    </div>
    <div class="stories-row">${storiesHtml}</div>
  </div>

  <!-- Quick Stats -->
  <div class="fb-section" style="padding:12px 16px">
    <div class="stats-grid">
      <div class="stat-card" onclick="navigate('employees')">
        <div class="stat-icon ic-blue"><i class="fas fa-users"></i></div>
        <div class="stat-value">${emps.length}</div>
        <div class="stat-label">พนักงานทั้งหมด</div>
      </div>
      <div class="stat-card" onclick="navigate('payroll')">
        <div class="stat-icon ic-green"><i class="fas fa-wallet"></i></div>
        <div class="stat-value" style="font-size:18px">${fmt.moneyK(totalSal)}</div>
        <div class="stat-label">ยอดเงินเดือน/เดือน</div>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="fb-section">
    <div class="fb-section-header">
      <div class="fb-section-title">ทางลัด</div>
    </div>
    <div class="quick-actions">
      <button class="qa-btn" onclick="navigate('attendance')">
        <div class="qa-icon ic-green"><i class="fas fa-calendar-check"></i></div>
        <span>เช็คชื่อ</span>
      </button>
      <button class="qa-btn" onclick="navigate('employees')">
        <div class="qa-icon ic-yellow">
          <i class="fas fa-hand-holding-usd"></i>
        </div>
        <span>เบิกเงิน</span>
      </button>
      <button class="qa-btn" onclick="navigate('payroll')">
        <div class="qa-icon ic-blue"><i class="fas fa-file-invoice-dollar"></i></div>
        <span>เงินเดือน</span>
      </button>
    </div>
  </div>

  <!-- Employee List -->
  <div class="fb-section" style="margin-bottom:0">
    <div class="fb-section-header">
      <div class="fb-section-title">พนักงานทั้งหมด</div>
      <button class="fb-section-action" onclick="navigate('employees')">ดูทั้งหมด</button>
    </div>
    ${emps.map(emp=>{
      const rec=DB.getAttRec(emp.id,todayKey());
      return `
      <div class="list-item" onclick="navigate('attendance')">
        <div class="avatar" style="background:${emp.avatar_color}">${emp.emoji||initials(emp.name)}</div>
        <div class="li-content">
          <div class="li-title">${emp.name}</div>
          <div class="li-sub">${emp.department}</div>
        </div>
        ${rec?statusBadge(rec.status):'<span class="badge badge-draft">ยังไม่บันทึก</span>'}
      </div>`;
    }).join('')}
  </div>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: DAILY ATTENDANCE ======= */
function renderDailyAtt(){
  const {date}=S.att;
  const emps=DB.getEmployees().filter(e=>e.status==='active');
  const dt=new Date(date+'T00:00:00');
  const dStr=`${dt.getDate()} ${TH_MONTHS_F[dt.getMonth()]} ${dt.getFullYear()+543}`;
  const recs=DB.getAttByDate(date);
  const cnts={
    present:recs.filter(r=>r.status==='present').length,
    late:   recs.filter(r=>r.status==='late').length,
    absent: recs.filter(r=>r.status==='absent').length,
    leave:  recs.filter(r=>['sick_leave','personal_leave','annual_leave'].includes(r.status)).length,
  };
  // simplified ui

  return `
  <div class="att-controls">
    <div class="date-nav">
      <button class="date-nav-btn" onclick="attDateMove(-1)"><i class="fas fa-chevron-left"></i></button>
      <div class="date-disp">${dStr}</div>
      <button class="date-nav-btn" onclick="attDateMove(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="view-toggle">
      <button class="vt-btn active" onclick="attMode('daily')">รายวัน</button>
      <button class="vt-btn" onclick="attMode('monthly')">ปฏิทิน</button>
    </div>
  </div>

  <!-- Summary Chips -->
  <div style="display:flex;background:var(--surface);border-bottom:1px solid var(--border)">
    <div class="att-stat-item" style="border-right:1px solid var(--border)">
      <div class="att-stat-num" style="color:var(--green)">${cnts.present}</div>
      <div class="att-stat-lbl">มาทำงาน</div>
    </div>
    <div class="att-stat-item" style="border-right:1px solid var(--border)">
      <div class="att-stat-num" style="color:var(--yellow)">${cnts.late}</div>
      <div class="att-stat-lbl">มาสาย</div>
    </div>
    <div class="att-stat-item" style="border-right:1px solid var(--border)">
      <div class="att-stat-num" style="color:var(--red)">${cnts.absent}</div>
      <div class="att-stat-lbl">ขาดงาน</div>
    </div>
    <div class="att-stat-item">
      <div class="att-stat-num" style="color:var(--t2)">${cnts.leave}</div>
      <div class="att-stat-lbl">ลา</div>
    </div>
  </div>

  <!-- Employee rows -->
  <div class="fb-section" style="margin-bottom:0">
    ${emps.map(emp=>{
      const rec=DB.getAttRec(emp.id,date);
      const st=rec?.status||'';
      return `
      <div class="list-item" style="align-items:center;padding:16px;cursor:pointer" onclick="showDayModal('${emp.id}','${date}')">
        <div class="avatar" style="background:${emp.avatar_color};box-shadow:0 2px 8px ${emp.avatar_color}44">${emp.emoji||initials(emp.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:var(--t1)">${emp.name}</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">${emp.department}</div>
          ${rec?.ot_hours?`<div style="font-size:11px;color:var(--orange);font-weight:700;margin-top:4px"><i class="fas fa-fire-alt"></i> OT ${rec.ot_hours} ชม.</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${rec?statusBadge(rec.status):`<button class="btn btn-success btn-xs" style="padding:8px 16px;border-radius:16px;font-weight:700;font-size:12px;letter-spacing:0;box-shadow:0 2px 6px rgba(66,183,42,.2)" onclick="event.stopPropagation();quickSetStatus('${emp.id}','${date}','present')"><i class="fas fa-check"></i> มาทำงาน</button>`}
          ${rec?`<i class="fas fa-chevron-right" style="color:var(--t3);font-size:14px;margin-left:4px"></i>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: MONTHLY ATTENDANCE ======= */
function renderMonthlyAtt(){
  const {month,year,empId}=S.att;
  const emps=DB.getEmployees().filter(e=>e.status==='active');
  const emp=empId?DB.getEmployee(empId):emps[0];
  if(!emp) return '<div class="empty-state"><div class="empty-icon-wrap"><i class="fas fa-users"></i></div><h3>ไม่พบพนักงาน</h3></div>';

  const recs=DB.getAttByEmp(emp.id,month,year);
  const rMap={};recs.forEach(r=>{rMap[parseInt(r.date.split('-')[2])]=r;});
  const total=daysInMonth(month,year),firstDow=firstDOW(month,year),todayK=todayKey();

  const cells=Array(firstDow).fill('<div></div>');
  for(let d=1;d<=total;d++){
    const dk=`${year}-${z2(month)}-${z2(d)}`;
    const rec=rMap[d],isT=dk===todayK,fut=dk>todayK;
    cells.push(`
    <div class="cal-cell ${isT?'today':''}" ${rec?`data-status="${rec.status}"`:''}
      onclick="showDayModal('${emp.id}','${dk}')" ${fut?'style="opacity:.35"':''}>
      <span class="cal-date">${d}</span>
      ${rec?.ot_hours?`<div class="cal-dot" style="background:var(--orange)"></div>`:''}
    </div>`);
  }

  const sum=Calc.summary(emp.id,month,year);

  return `
  <div class="att-controls">
    <div class="date-nav">
      <button class="date-nav-btn" onclick="attMonthMove(-1)"><i class="fas fa-chevron-left"></i></button>
      <div class="date-disp">${fmt.monthY(month,year)}</div>
      <button class="date-nav-btn" onclick="attMonthMove(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="view-toggle">
      <button class="vt-btn" onclick="attMode('daily')">รายวัน</button>
      <button class="vt-btn active" onclick="attMode('monthly')">ปฏิทิน</button>
    </div>
  </div>

  <div class="fb-section" style="padding:10px 14px;border-bottom:1px solid var(--border)">
    <select class="form-select" onchange="attEmpChange(this.value)">
      ${emps.map(e=>`<option value="${e.id}" ${e.id===emp.id?'selected':''}>${e.name}</option>`).join('')}
    </select>
  </div>

  <div class="fb-section">
    <div class="cal-hd">
      ${TH_DAYS_S.map((d,i)=>`<div class="cal-day-name" style="${i===0||i===6?'color:var(--red)':''}">${d}</div>`).join('')}
    </div>
    <div class="cal-grid">${cells.join('')}</div>
  </div>

  <div class="status-legend">
    ${[['var(--green)','มาทำงาน'],['var(--yellow)','มาสาย'],['var(--red)','ขาดงาน'],['var(--blue)','ลาป่วย'],['var(--cyan)','ลากิจ'],['var(--purple)','พักร้อน'],['var(--orange)','มี OT']].map(([c,l])=>
      `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${l}</div>`).join('')}
  </div>

  <!-- Monthly Summary -->
  <div class="fb-section" style="padding:14px 16px">
    <div class="fb-section-title" style="margin-bottom:12px">สรุป${TH_MONTHS_F[month-1]}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[['var(--green)',sum.present,'วันมา'],['var(--yellow)',sum.late,'มาสาย'],['var(--red)',sum.absent,'ขาดงาน'],
         ['var(--blue)',sum.sick,'ลาป่วย'],['var(--cyan)',sum.personal,'ลากิจ'],['var(--orange)',sum.otTotal+'ชม.','OT รวม']
      ].map(([c,v,l])=>`
        <div class="stat-card" style="padding:12px">
          <div class="stat-value" style="font-size:20px;color:${c}">${v}</div>
          <div class="stat-label">${l}</div>
        </div>`).join('')}
    </div>
  </div>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: EXPENSE ======= */
function renderExpense(){ return ''; }

/* ======= RENDER: PAYROLL ======= */
function renderPayroll(){
  const {month,year,cycle}=S.pay;
  const emps=DB.getEmployees().filter(e=>e.status==='active');
  const ps=emps.map(e=>Calc.payslip(e.id,month,year,cycle));
  const total=ps.reduce((s,p)=>s+p.net_pay,0);
  const lastD=daysInMonth(month,year);
  const payD=cycle===1?15:lastD;

  return `
  <div class="pay-controls">
    <div class="pay-month-nav">
      <button class="pay-month-nav-btn" onclick="payMonthMove(-1)"><i class="fas fa-chevron-left"></i></button>
      <div class="pay-month-title">${fmt.monthY(month,year)}</div>
      <button class="pay-month-nav-btn" onclick="payMonthMove(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="pay-cycle-tabs">
      <div class="pay-cycle-tab ${cycle===1?'active':''}" onclick="setPayCycle(1)">
        <div class="pct-date">15</div>
        <div class="pct-label">รอบ 1 — ล่วงหน้า 50%</div>
      </div>
      <div class="pay-cycle-tab ${cycle===2?'active':''}" onclick="setPayCycle(2)">
        <div class="pct-date">${lastD}</div>
        <div class="pct-label">รอบ 2 — สิ้นเดือน</div>
      </div>
    </div>
  </div>

  <div class="pay-total-bar">
    <div>
      <div class="pay-total-lbl">ยอดจ่ายรวม • รอบที่ ${cycle}</div>
      <div class="pay-total-date">วันที่ ${payD} ${TH_MONTHS_S[month-1]} ${year+543}</div>
    </div>
    <div class="pay-total-amt">${fmt.money(total)}</div>
  </div>

  <div class="info-pill ${cycle===2?'blue':'green'}">
    <i class="fas fa-info-circle"></i>
    ${cycle===1?'รอบ 1: จ่ายล่วงหน้า 50% ไม่มีรายหัก/เพิ่ม':'รอบ 2: เงินเดือน + OT + เบี้ยขยัน + เบิก − ภาษี − หักขาด/สาย − กู้'}
  </div>

  <div class="fb-section" style="margin-bottom:0">
    ${ps.map(p=>{
      const chips=[];
      if(p.ot_total>0)      chips.push(`<span class="pay-chip chip-ot">OT +${fmt.money(p.ot_total)}</span>`);
      if(p.diligent>0)      chips.push(`<span class="pay-chip chip-present">ขยัน +${fmt.money(p.diligent)}</span>`);
      if(p.expense_total>0) chips.push(`<span class="pay-chip chip-personal">เบิก +${fmt.money(p.expense_total)}</span>`);
      if(p.tax_deduct>0)    chips.push(`<span class="pay-chip chip-absent">ภาษี -${fmt.money(p.tax_deduct)}</span>`);
      if(p.abs_deduct>0)    chips.push(`<span class="pay-chip chip-absent">ขาด -${fmt.money(p.abs_deduct)}</span>`);
      if(p.loan_deduct>0)   chips.push(`<span class="pay-chip chip-late">กู้ -${fmt.money(p.loan_deduct)}</span>`);
      return `
      <div class="pay-emp-card" onclick="showPayslip('${p.emp.id}',${month},${year},${cycle})">
        <div class="pay-emp-top">
          <div class="avatar" style="background:${p.emp.avatar_color}">${p.emp.emoji||initials(p.emp.name)}</div>
          <div style="flex:1">
            <div class="pay-emp-name">${p.emp.name}</div>
            <div class="pay-emp-dept">${p.emp.department}</div>
          </div>
          <div>
            <div class="pay-net-amt" style="color:${cycle===2?'var(--green)':'var(--purple)'}">${fmt.money(p.net_pay)}</div>
            <div class="pay-net-lbl">ดูสลิป <i class="fas fa-chevron-right" style="font-size:10px"></i></div>
          </div>
        </div>
        ${chips.length?`<div class="pay-chips">${chips.join('')}</div>`:''}
      </div>`;
    }).join('')}
  </div>

  <button class="pay-confirm-btn" onclick="confirmPayroll()">
    <i class="fas fa-paper-plane"></i>&nbsp; ยืนยันจ่ายเงินเดือน รอบ ${cycle} &nbsp;·&nbsp; ${fmt.money(total)}
  </button>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: MENU ======= */
function renderMenu(){
  return `
  <div class="fb-section" style="padding:16px 16px 0;background:var(--surface)">
    <div class="menu-header">เมนู</div>
    <div class="menu-grid">
      <div class="menu-card" onclick="showSharedQR()" style="background:var(--blue)15;border:1px solid var(--blue)40;">
        <i class="fas fa-qrcode" style="color:var(--blue)"></i>
        <span style="color:var(--blue);font-weight:bold;">QR จุดลงเวลา</span>
      </div>
      <div class="menu-card" onclick="navigate('employees')">
        <i class="fas fa-users" style="color:var(--purple)"></i>
        <span>รายชื่อพนักงาน</span>
      </div>
      <div class="menu-card" onclick="toast('ฟีเจอร์รายงานกำลังพัฒนา','info')">
        <i class="fas fa-chart-pie" style="color:var(--green)"></i>
        <span>สรุปรายงาน</span>
      </div>
      <div class="menu-card" onclick="toast('ฟีเจอร์ตั้งค่ากำลังพัฒนา','info')">
        <i class="fas fa-cog" style="color:var(--t2)"></i>
        <span>การตั้งค่า</span>
      </div>
      <div class="menu-card" onclick="toast('ส่งออกข้อมูล Excel','info')">
        <i class="fas fa-file-excel" style="color:var(--orange)"></i>
        <span>ส่งออกข้อมูล</span>
      </div>
    </div>
  </div>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: EMPLOYEES ======= */
function renderEmployees(){
  const {search}=S.emp;
  let emps=DB.getEmployees();
  if(search){const q=search.toLowerCase();emps=emps.filter(e=>e.name.toLowerCase().includes(q)||e.department.toLowerCase().includes(q)||e.position.toLowerCase().includes(q));}
  const total=DB.getEmployees().reduce((s,e)=>s+e.base_salary,0);

  return `
  <!-- Search Bar — Facebook style pill -->
  <div class="fb-section" style="padding:10px 14px 12px">
    <div class="fb-search-wrap">
      <i class="fas fa-search icon" style="color:var(--t3)"></i>
      <input type="search" class="fb-search" placeholder="ค้นหาชื่อ แผนก ตำแหน่ง..."
        value="${search}" oninput="empSearch(this.value)">
    </div>
  </div>

  <!-- Stats -->
  <div style="padding:0 16px 16px">
    <div style="display:flex;gap:12px">
      <div style="flex:1;padding:16px 12px;background:var(--blue-bg);border-radius:var(--r-xl);text-align:center;border:1px solid rgba(8,102,255,0.1);box-shadow:0 4px 12px rgba(8,102,255,0.05)">
        <div style="font-size:28px;font-weight:900;color:var(--purple);line-height:1">${DB.getEmployees().length}</div>
        <div style="font-size:13px;color:var(--purple);font-weight:700;margin-top:6px;opacity:0.85">พนักงาน</div>
      </div>
      <div style="flex:2;padding:16px;background:var(--green-bg);border-radius:var(--r-xl);display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(66,183,42,0.1);box-shadow:0 4px 12px rgba(66,183,42,0.05)">
        <div style="font-size:14px;color:#175f0f;font-weight:800">เงินเดือนรวม/เดือน</div>
        <div style="font-size:24px;font-weight:900;color:var(--green);letter-spacing:-0.02em">${fmt.moneyK(total)}</div>
      </div>
    </div>
  </div>

  <!-- Employee List — Facebook Friends list -->
  <div class="fb-section" style="margin-bottom:0">
    ${emps.length===0?`
    <div class="empty-state">
      <div class="empty-icon-wrap"><i class="fas fa-user-slash"></i></div><h3>ไม่พบพนักงาน</h3>
      <p>ลองค้นหาด้วยคำอื่น</p>
    </div>`:
    emps.map(emp=>`
    <div class="emp-card" onclick="viewEmpDetail('${emp.id}')">
      <div class="avatar av-md" style="background:${emp.avatar_color}">${emp.emoji||initials(emp.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="emp-name">${emp.name}</div>
        <div class="emp-dept">${emp.position} &nbsp;·&nbsp; ${emp.department}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="emp-salary">${fmt.money(Math.round(emp.base_salary/30))}</div>
        <div style="font-size:10px;color:var(--t3);font-weight:500">/วัน</div>
      </div>
    </div>`).join('')}
  </div>
  <button class="fab" onclick="showEmpModal(null)"><i class="fas fa-plus"></i></button>
  <div style="height:80px"></div>`;
}

/* ======= RENDER: EMP DETAIL ======= */
function renderEmpDetail(empId){
  const emp=DB.getEmployee(empId);
  if(!emp) return '<div class="empty-state"><div class="empty-icon-wrap"><i class="fas fa-user-slash"></i></div><h3>ไม่พบพนักงาน</h3></div>';
  const m=S.pay.month, y=S.pay.year;
  const sum=Calc.summary(empId,m,y);
  const draws=DB.getDrawByEmp(empId,m,y);
  const ps=Calc.payslip(empId,m,y,2);

  const st = Calc.earnedSoFar(empId, m, y, todayKey());

  return `
  <div class="emp-detail-cover">
    <div class="avatar av-xl" style="background:${emp.avatar_color};box-shadow:0 4px 20px ${emp.avatar_color}55">${emp.emoji||initials(emp.name)}</div>
    <div class="emp-detail-name">${emp.name}</div>
    <div class="emp-detail-pos">${emp.position} &nbsp;·&nbsp; ${emp.department}</div>
    <div class="emp-detail-sal">${fmt.money(Math.round(emp.base_salary/30))}<span style="font-size:14px;color:var(--t2);font-weight:500">/วัน</span></div>
    
    <div style="margin:20px 0 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:16px;text-align:left;position:relative;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.03)">
      <div style="position:absolute;top:50%;left:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg);transform:translateY(-50%)"></div>
      <div style="position:absolute;top:50%;right:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg);transform:translateY(-50%)"></div>
      <div style="font-size:12px;color:var(--t2);font-weight:800;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.02em"><i class="fas fa-wallet" style="color:var(--purple)"></i> กระเป๋าเงินรอบนี้ (รอบ ${st.cycle})</div>
      <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--t2);margin-bottom:6px">
        <span>ทำงานมาแล้ว ${st.days} วัน</span><span style="color:var(--t1);font-weight:700">${fmt.money(st.earned)}</span>
      </div>
      ${st.draws > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:var(--t2);margin-bottom:10px">
        <span>เบิกไปแล้ว</span><span style="color:var(--red);font-weight:700">- ${fmt.money(st.draws)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1.5px dashed var(--border);align-items:center;margin-top:12px">
        <span style="font-size:13px;font-weight:800;color:var(--purple)">ยอดเบิกได้ตอนนี้</span>
        <span style="font-size:22px;font-weight:900;color:var(--green);letter-spacing:-0.02em">${fmt.money(st.max)}</span>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:16px;padding:0 4px">
      <button class="btn" style="flex:1;background:#E5E5EA;color:var(--t1);border-radius:var(--r-lg);font-weight:700;padding:12px" onclick="showEmpModal('${emp.id}')">
        <i class="fas fa-edit"></i> แก้ไขข้อมูล
      </button>
      <button class="btn" style="flex:1;background:var(--red-bg);color:var(--red);border-radius:var(--r-lg);font-weight:700;padding:12px" onclick="delEmpConfirm('${emp.id}')">
        <i class="fas fa-trash"></i> ลบพนักงาน
      </button>
    </div>
    <div style="margin-top:12px;padding:0 4px">
      <button class="btn" style="width:100%;background:var(--blue);color:#fff;border-radius:var(--r-lg);font-weight:700;padding:12px" onclick="showQR('${emp.id}')">
        <i class="fas fa-qrcode"></i> แสดง QR Code ประจำตัว
      </button>
    </div>
  </div>

  <!-- Info Grid -->
  <div style="background:var(--surface);border-radius:var(--r-xl);margin:16px;border:1px solid var(--border);overflow:hidden">
    <div class="emp-info-grid">
      ${[['โทรศัพท์',emp.phone||'-'],['บัญชีธนาคาร',emp.bank_account||'-'],['วันเริ่มงาน',fmt.date(emp.start_date)],['เบี้ยขยัน',fmt.money(emp.allowance_diligent||0)],['หักเงินกู้/เดือน',fmt.money(emp.loan_monthly||0)],['สถานะ','<span class="badge badge-approved" style="background:#E8F5E4;color:#1A6611">ทำงานอยู่</span>']].map(([l,v])=>`
      <div class="eig-item" style="padding:16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border)"><div class="eig-label" style="font-size:11px;color:var(--t3);font-weight:700;margin-bottom:6px">${l}</div><div class="eig-value" style="font-size:14px;color:var(--t1);font-weight:600">${v}</div></div>`).join('')}
    </div>
  </div>

  <!-- Monthly Summary -->
  <div class="fb-section" style="padding:14px 16px">
    <div class="fb-section-title" style="margin-bottom:12px">สรุปเดือน ก.ค. 2569</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[['var(--green)',sum.present,'วันมา'],['var(--yellow)',sum.late,'มาสาย'],['var(--red)',sum.absent,'ขาดงาน'],
         ['var(--orange)',sum.otTotal+'ชม.','OT'],['var(--blue)',draws.length,'ครั้งที่เบิก'],['var(--green)',fmt.moneyK(ps?.net_pay||0),'รอบ 2 สุทธิ']
      ].map(([c,v,l])=>`
        <div class="stat-card" style="padding:12px">
          <div class="stat-value" style="font-size:19px;color:${c}">${v}</div>
          <div class="stat-label">${l}</div>
        </div>`).join('')}
    </div>
  </div>

  <div class="fb-section" style="margin-bottom:0">
    <div class="fb-section-header">
      <div class="fb-section-title">ประวัติเบิกเงิน/หักค่าอาหาร</div>
      <button class="fb-section-action" onclick="showDrawModal('${emp.id}')"><i class="fas fa-plus"></i> เพิ่มรายการ</button>
    </div>
    ${draws.length ? draws.map(e=>`
    <div class="list-item">
      <div class="exp-type-icon av-sm" style="background:var(--red-bg);color:var(--red)"><i class="fas fa-hand-holding-usd"></i></div>
      <div class="li-content"><div class="li-title">${e.description}</div><div class="li-sub">${fmt.date(e.date)}</div></div>
      <div class="li-right"><div style="font-weight:700;color:var(--red)">- ${fmt.money(e.amount)}</div><button class="btn btn-neutral btn-xs" style="margin-top:4px" onclick="deleteDraw('${e.id}')"><i class="fas fa-trash"></i></button></div>
    </div>`).join('') : '<div style="padding:16px;text-align:center;color:var(--t2)">ยังไม่มีประวัติการเบิก/หักเงิน</div>'}
  </div>
  <div style="height:80px"></div>`;
}

/* ======= MODALS ======= */
function openModal(html){
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-backdrop').classList.add('show');
  document.getElementById('modal-sheet').classList.add('show');
}
function closeModal(){
  document.getElementById('modal-backdrop').classList.remove('show');
  document.getElementById('modal-sheet').classList.remove('show');
}

/* --- Payslip --- */
function showPayslip(id,m,y,cycle){
  const ps=Calc.payslip(id,m,y,cycle); if(!ps) return;
  const {emp}=ps;

  let body='';
  if(cycle===1){
    body=`
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:16px;margin:20px 0;position:relative;overflow:hidden">
        <div style="position:absolute;top:-10px;left:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
        <div style="position:absolute;top:-10px;right:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
        <div style="text-align:center;padding:12px 0 20px;border-bottom:1.5px dashed var(--border);margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;color:#1A6611;margin-bottom:6px"><i class="fas fa-check-circle"></i> ยอดจ่ายล่วงหน้า 15 วัน</div>
          <div style="font-size:42px;font-weight:900;color:var(--green);letter-spacing:-0.03em">${fmt.money(ps.advance)}</div>
        </div>
        <div class="payslip-row income"><span class="payslip-lbl">เงินเดือนฐาน</span><span style="font-weight:700">${fmt.money(ps.salary_base)}</span></div>
        <div class="payslip-row income"><span class="payslip-lbl">จ่ายล่วงหน้า 15 วัน</span><span style="font-weight:800;color:var(--purple)">${fmt.money(ps.advance)}</span></div>
      </div>
      <div style="padding:12px;background:var(--blue-bg);border-radius:var(--r-md);font-size:13px;color:var(--purple);font-weight:600;text-align:center">
        <i class="fas fa-info-circle"></i> ยอด OT / เบิก / หัก จะคำนวณในรอบ 2
      </div>`;
  }else{
    body=`
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:16px;margin:20px 0;position:relative;overflow:hidden">
        <div style="position:absolute;bottom:100px;left:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
        <div style="position:absolute;bottom:100px;right:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
        <div class="payslip-section-lbl">รายได้</div>
        <div class="payslip-row income"><span class="payslip-lbl">เงินเดือนส่วนที่เหลือ</span><span>${fmt.money(ps.salary_rem)}</span></div>
        ${ps.ot_norm>0?`<div class="payslip-row income"><span class="payslip-lbl">OT วันธรรมดา (${ps.ot_norm_h}ชม.)</span><span>+${fmt.money(ps.ot_norm)}</span></div>`:''}
        ${ps.ot_hol>0?`<div class="payslip-row income"><span class="payslip-lbl">OT วันหยุด (${ps.ot_hol_h}ชม.)</span><span>+${fmt.money(ps.ot_hol)}</span></div>`:''}
        ${ps.diligent>0?`<div class="payslip-row income"><span class="payslip-lbl">เบี้ยขยัน</span><span>+${fmt.money(ps.diligent)}</span></div>`:''}
        <div class="payslip-row total-income"><span>รายได้รวม</span><span>${fmt.money(ps.gross)}</span></div>
        
        <div class="payslip-section-lbl" style="margin-top:16px">รายหัก</div>
        ${ps.abs_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">หักขาด ${ps.absent_days} วัน</span><span>- ${fmt.money(ps.abs_deduct)}</span></div>`:''}
        ${ps.late_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">หักมาสาย ${ps.late_min} นาที</span><span>- ${fmt.money(ps.late_deduct)}</span></div>`:''}
        ${ps.loan_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">ผ่อนชำระเงินกู้</span><span>- ${fmt.money(ps.loan_deduct)}</span></div>`:''}
        ${ps.draw_total>0?`<div class="payslip-row deduct"><span class="payslip-lbl">เบิกเงินล่วงหน้า / ค่าอาหาร</span><span>- ${fmt.money(ps.draw_total)}</span></div>`:''}
        ${ps.total_deduct===0?`<div class="payslip-row"><span class="payslip-lbl" style="color:var(--t3)">ไม่มีรายหัก</span><span>—</span></div>`:''}
        <div class="payslip-row total-deduct" style="margin-bottom:16px"><span>หักรวม</span><span>- ${fmt.money(ps.total_deduct)}</span></div>
        
        <div style="border-top:1.5px dashed var(--border);margin:0 -16px;padding:24px 16px 8px;text-align:center">
          <div style="font-size:12px;font-weight:800;color:#1A6611;margin-bottom:4px"><i class="fas fa-check-circle"></i> ยอดสุทธิ (รอบ 2)</div>
          <div style="font-size:42px;font-weight:900;color:var(--green);letter-spacing:-0.03em">${fmt.money(ps.net_pay)}</div>
        </div>
      </div>
      <div style="padding:12px;background:var(--hover);border-radius:var(--r-md);font-size:13px;color:var(--t2);text-align:center;font-weight:500">
        จ่ายล่วงหน้ารอบ 1: ${fmt.money(ps.advance_paid)} &nbsp;·&nbsp; รวมทั้งเดือน: <strong style="color:var(--t1)">${fmt.money(ps.net_pay+ps.advance_paid)}</strong>
      </div>`;
  }

  openModal(`
    <div class="modal-title"><i class="fas fa-file-invoice-dollar"></i> สลิปเงินเดือน</div>
    <div>
      <div class="payslip-hd">
        <div class="avatar av-lg" style="background:${emp.avatar_color};margin:0 auto 12px;box-shadow:0 4px 12px ${emp.avatar_color}44">${emp.emoji||initials(emp.name)}</div>
        <div style="font-size:20px;font-weight:800;color:var(--t1)">${emp.name}</div>
        <div style="font-size:13px;color:var(--t2);margin-top:4px">${emp.position} · ${emp.department}</div>
        <div style="margin-top:8px">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;background:var(--blue-bg);border-radius:var(--r-full);font-size:12px;font-weight:700;color:var(--purple)">
            รอบ ${cycle} ${cycle===1?'(วันที่ 15)':'(สิ้นเดือน)'} · ${fmt.monthY(m,y)}
          </span>
        </div>
      </div>
      ${body}
    </div>
    <div style="height:12px"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()"><i class="fas fa-times"></i> ปิด</button>
      <button class="btn btn-primary" style="flex:1;border-radius:var(--r-md)" onclick="exportPayslip('${id}',${m},${y},${cycle})"><i class="fas fa-download"></i> บันทึกรูป</button>
    </div>
  `);
}

function exportPayslip(id,m,y,cycle){
  const ps=Calc.payslip(id,m,y,cycle); if(!ps) return;
  const {emp}=ps;
  let c = document.getElementById('capture-container');
  if(!c){
    c = document.createElement('div');
    c.id = 'capture-container';
    document.body.appendChild(c);
  }
  
  let body='';
  if(cycle===1){
    body=`
      <div class="net-box" style="margin-top:0">
        <div class="net-box-label"><i class="fas fa-money-bill-wave"></i> ยอดจ่ายล่วงหน้า 50%</div>
        <div class="net-box-amount">${fmt.money(ps.advance)}</div>
      </div>
      <div class="payslip-row income"><span class="payslip-lbl">เงินเดือนฐาน</span><span style="font-weight:700">${fmt.money(ps.salary_base)}</span></div>
      <div class="payslip-row income"><span class="payslip-lbl">จ่ายล่วงหน้า 50%</span><span style="font-weight:800;color:var(--purple)">${fmt.money(ps.advance)}</span></div>`;
  }else{
    body=`
      <div class="payslip-section-lbl">รายได้</div>
      <div class="payslip-row income"><span class="payslip-lbl">เงินเดือนส่วนที่เหลือ (50%)</span><span>${fmt.money(ps.salary_rem)}</span></div>
      ${ps.ot_norm>0?`<div class="payslip-row income"><span class="payslip-lbl">OT วันธรรมดา</span><span>+${fmt.money(ps.ot_norm)}</span></div>`:''}
      ${ps.ot_hol>0?`<div class="payslip-row income"><span class="payslip-lbl">OT วันหยุด</span><span>+${fmt.money(ps.ot_hol)}</span></div>`:''}
      ${ps.diligent>0?`<div class="payslip-row income"><span class="payslip-lbl">เบี้ยขยัน</span><span>+${fmt.money(ps.diligent)}</span></div>`:''}
      ${ps.expense_total>0?`<div class="payslip-row income"><span class="payslip-lbl">ค่าใช้จ่ายเบิก</span><span>+${fmt.money(ps.expense_total)}</span></div>`:''}
      <div class="payslip-row total-income"><span>รายได้รวม</span><span>${fmt.money(ps.gross)}</span></div>
      <div class="payslip-section-lbl">รายหัก</div>
      ${ps.tax_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">ภาษีเงินได้</span><span>- ${fmt.money(ps.tax_deduct)}</span></div>`:''}
      ${ps.abs_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">หักขาด</span><span>- ${fmt.money(ps.abs_deduct)}</span></div>`:''}
      ${ps.late_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">หักมาสาย</span><span>- ${fmt.money(ps.late_deduct)}</span></div>`:''}
      ${ps.loan_deduct>0?`<div class="payslip-row deduct"><span class="payslip-lbl">ผ่อนชำระเงินกู้</span><span>- ${fmt.money(ps.loan_deduct)}</span></div>`:''}
      ${ps.total_deduct===0?`<div class="payslip-row"><span class="payslip-lbl" style="color:var(--t3)">ไม่มีรายหัก</span><span>—</span></div>`:''}
      <div class="payslip-row total-deduct"><span>หักรวม</span><span>- ${fmt.money(ps.total_deduct)}</span></div>
      <div class="net-box">
        <div class="net-box-label">ยอดจ่ายสุทธิ รอบ 2</div>
        <div class="net-box-amount">${fmt.money(ps.net_pay)}</div>
      </div>`;
  }
  
  c.innerHTML = `<div class="payslip-capture-area" id="payslip-capture" style="font-family:'Sarabun',sans-serif">
    <div style="text-align:center;margin-bottom:16px;border-bottom:2px dashed #eee;padding-bottom:12px">
      <div style="font-size:18px;font-weight:800;color:var(--t1)">${CFG.company}</div>
      <div style="font-size:24px;font-weight:900;color:var(--t1);margin-top:8px">สลิปเงินเดือน</div>
      <div style="font-size:14px;color:var(--t2);margin-top:4px">${emp.name} · ${emp.department}</div>
      <div style="font-size:13px;font-weight:700;color:var(--purple);margin-top:4px">รอบ ${cycle} · ${fmt.monthY(m,y)}</div>
    </div>
    ${body}
  </div>`;
  
  toast('กำลังสร้างรูปภาพ...','info');
  setTimeout(()=>{
    html2canvas(document.getElementById('payslip-capture'), {scale: 2, useCORS: true}).then(canvas => {
      const link = document.createElement('a');
      link.download = `Payslip_${emp.name}_${m}_${y}_รอบ${cycle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('บันทึกรูปภาพสำเร็จ ✅','success');
      c.innerHTML = '';
    }).catch(err => {
      console.error(err);
      toast('ไม่สามารถสร้างรูปภาพได้','error');
    });
  }, 300);
}

/* --- Add Expense Modal --- */
function showAddExpModal(){
  const emps=DB.getEmployees().filter(e=>e.status==='active');
  openModal(`
    <div class="modal-title"><i class="fas fa-receipt"></i> เพิ่มใบเบิก / ลงบิล</div>
    <div class="form-group">
      <label class="form-label">พนักงาน</label>
      <select class="form-select" id="xemp">${emps.map(e=>`<option value="${e.id}">${e.name} — ${e.department}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">วันที่</label>
        <input type="date" class="form-input" id="xdate" value="${todayKey()}">
      </div>
      <div class="form-group">
        <label class="form-label">ประเภท</label>
        <select class="form-select" id="xtype">
          <option value="meal">🍽️ ค่าอาหาร</option>
          <option value="travel">🚗 ค่าเดินทาง</option>
          <option value="misc">📋 อื่น ๆ</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">รายละเอียด *</label>
      <input type="text" class="form-input" id="xdesc" placeholder="เช่น ค่าอาหารประชุมทีม">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">จำนวนเงิน (฿) *</label>
        <input type="number" class="form-input" id="xamount" placeholder="0" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">เลขที่บิล</label>
        <input type="text" class="form-input" id="xreceipt" placeholder="RC-XXXX">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" style="flex:2;border-radius:var(--r-md)" onclick="submitExp()"><i class="fas fa-save"></i> บันทึก</button>
    </div>
  `);
}

/* --- Expense Detail --- */
function showExpDetail(id){
  const exp=DB.getExpense(id); if(!exp) return;
  const emp=DB.getEmployee(exp.employee_id);
  openModal(`
    <div class="modal-title">${expEmoji(exp.type)} รายละเอียดการเบิก</div>
    <div style="text-align:center;padding:18px;background:var(--hover);border-radius:var(--r-xl);margin-bottom:14px">
      <div class="exp-type-icon ${expCls(exp.type)}" style="margin:0 auto 10px;width:52px;height:52px;font-size:26px">${expEmoji(exp.type)}</div>
      <div style="font-size:13px;color:var(--t2);font-weight:600">${expLabel(exp.type)}</div>
      <div style="font-size:34px;font-weight:900;color:var(--t1);margin:4px 0;letter-spacing:-0.02em">${fmt.money(exp.amount)}</div>
      <div>${statusBadge(exp.status)}</div>
    </div>
    ${emp?`
    <div class="list-item" style="border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:12px">
      <div class="avatar" style="background:${emp.avatar_color}">${emp.emoji||initials(emp.name)}</div>
      <div class="li-content"><div class="li-title">${emp.name}</div><div class="li-sub">${emp.department}</div></div>
    </div>`:''}
    <div style="background:var(--hover);border-radius:var(--r-xl);overflow:hidden;margin-bottom:14px">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:4px">รายละเอียด</div>
        <div style="font-size:16px;font-weight:600;color:var(--t1)">${exp.description}</div>
      </div>
      <div style="padding:12px 16px;display:flex;gap:24px">
        <div><div style="font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px">วันที่</div><div style="font-size:14px;font-weight:700">${fmt.date(exp.date)}</div></div>
        ${exp.receipt_ref?`<div><div style="font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px">เลขที่บิล</div><div style="font-size:14px;font-weight:700">${exp.receipt_ref}</div></div>`:''}
      </div>
      ${exp.reject_reason?`<div style="padding:12px 16px;background:var(--red-bg);border-top:1px solid var(--border)"><div style="font-size:12px;color:var(--red);font-weight:700;margin-bottom:3px"><i class="fas fa-times-circle"></i> เหตุผลที่ปฏิเสธ</div><div style="font-size:13px;color:var(--red)">${exp.reject_reason}</div></div>`:''}
    </div>
    ${exp.status==='pending'?`
    <div style="display:flex;gap:8px">
      <button class="btn btn-danger" style="flex:1;border-radius:var(--r-md)" onclick="rejectExp('${exp.id}');closeModal()"><i class="fas fa-times"></i> ปฏิเสธ</button>
      <button class="btn btn-success" style="flex:1;border-radius:var(--r-md)" onclick="approveExp('${exp.id}');closeModal()"><i class="fas fa-check"></i> อนุมัติ</button>
    </div>`:
    `<button class="btn btn-neutral btn-block btn-round" onclick="closeModal()">ปิด</button>`}
  `);
}

/* --- Day Detail Modal --- */
function showDayModal(empId,date){
  const emp=DB.getEmployee(empId); if(!emp) return;
  const rec=DB.getAttRec(empId,date)||{};
  const dt=new Date(date+'T00:00:00');
  const dStr=`${dt.getDate()} ${TH_MONTHS_F[dt.getMonth()]} ${dt.getFullYear()+543}`;
  const opts=[
    {v:'present',l:'✅ มาทำงาน'},{v:'late',l:'⏰ มาสาย'},{v:'absent',l:'❌ ขาดงาน'},
    {v:'sick_leave',l:'🏥 ลาป่วย'},{v:'personal_leave',l:'📝 ลากิจ'},
    {v:'annual_leave',l:'🏖️ พักร้อน'},{v:'holiday',l:'🎌 วันหยุด'},
  ];
  openModal(`
    <div class="modal-title"><i class="fas fa-calendar-day"></i> บันทึกการเข้างาน</div>
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--hover);border-radius:var(--r-xl);margin-bottom:16px">
      <div class="avatar" style="background:${emp.avatar_color}">${emp.emoji||initials(emp.name)}</div>
      <div><div style="font-weight:700;font-size:15px">${emp.name}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">${dStr}</div></div>
    </div>
    <div class="form-group">
      <label class="form-label">สถานะการเข้างาน</label>
      <select class="form-select" id="dstatus" onchange="toggleLateGrp(this.value)">
        ${opts.map(o=>`<option value="${o.v}" ${rec.status===o.v?'selected':''}>${o.l}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" id="late-grp" style="${rec.status==='late'?'':'display:none'}">
      <label class="form-label">นาทีที่สาย</label>
      <input type="number" class="form-input" id="dlate" value="${rec.late_minutes||0}" min="0" max="300">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">OT (ชั่วโมง)</label>
        <input type="number" class="form-input" id="dot-h" value="${rec.ot_hours||0}" min="0" max="12" step="0.5" oninput="updateOTPreview(${emp.base_salary})">
      </div>
      <div class="form-group">
        <label class="form-label">ประเภท OT</label>
        <select class="form-select" id="dot-t" onchange="updateOTPreview(${emp.base_salary})">
          <option value="normal" ${rec.ot_type==='normal'?'selected':''}>วันธรรมดา ×1.5</option>
          <option value="holiday" ${rec.ot_type==='holiday'?'selected':''}>วันหยุด ×3.0</option>
        </select>
      </div>
    </div>
    <div id="ot-preview" style="padding:14px;background:var(--orange-bg);border-radius:var(--r-lg);text-align:center;margin-bottom:14px;${!rec.ot_hours?'display:none':''}">
      <div style="font-size:12px;color:var(--orange);font-weight:700">ค่า OT โดยประมาณ</div>
      <div style="font-size:28px;font-weight:900;color:var(--orange)" id="ot-amt-disp">${fmt.money(Math.round(Calc.otAmt(emp.base_salary,rec.ot_hours||0,rec.ot_type||'normal')))}</div>
    </div>
    <div class="form-group">
      <label class="form-label">เบิกเงินวันนี้ (฿)</label>
      <input type="number" class="form-input" id="ddraw" placeholder="0" min="0">
    </div>
    <div class="form-group">
      <label class="form-label">หมายเหตุ</label>
      <input type="text" class="form-input" id="dnote" value="${rec.note||''}" placeholder="หมายเหตุ (ถ้ามี)">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" style="flex:2;border-radius:var(--r-md)" onclick="submitDay('${empId}','${date}')"><i class="fas fa-save"></i> บันทึก</button>
    </div>
  `);
}

/* --- Employee Modal --- */
function showEmpModal(empId){
  const emp=empId?DB.getEmployee(empId):null;
  const clrs=['#6C47FF','#E1306C','#0866FF','#42B72A','#F7B928','#F4813F','#FA383E','#1DA1F2'];
  openModal(`
    <div class="modal-title"><i class="fas fa-user-${emp?'edit':'plus'}"></i> ${emp?'แก้ไขข้อมูลพนักงาน':'เพิ่มพนักงานใหม่'}</div>
    <div class="form-group">
      <label class="form-label">ชื่อ-นามสกุล *</label>
      <input type="text" class="form-input" id="en" value="${emp?.name||''}" placeholder="ชื่อ นามสกุล">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">แผนก *</label>
        <input type="text" class="form-input" id="ed" value="${emp?.department||''}" placeholder="เช่น การตลาด">
      </div>
      <div class="form-group">
        <label class="form-label">ตำแหน่ง *</label>
        <input type="text" class="form-input" id="ep" value="${emp?.position||''}" placeholder="เช่น ผู้จัดการ">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">ค่าแรงรายวัน (฿) *</label>
        <input type="number" class="form-input" id="es" value="${emp ? Math.round(emp.base_salary/30) : 300}" placeholder="300">
      </div>
      <div class="form-group">
        <label class="form-label">วันเริ่มงาน</label>
        <input type="date" class="form-input" id="est" value="${emp?.start_date||todayKey()}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">โทรศัพท์</label>
        <input type="text" class="form-input" id="eph" value="${emp?.phone||''}" placeholder="08X-XXX-XXXX">
      </div>
      <div class="form-group">
        <label class="form-label">เลขบัญชีธนาคาร</label>
        <input type="text" class="form-input" id="eb" value="${emp?.bank_account||''}" placeholder="XXX-X-XXXXX-X">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">เบี้ยขยัน (฿/เดือน)</label>
        <input type="number" class="form-input" id="ea" value="${emp?.allowance_diligent||0}" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">หักเงินกู้ (฿/เดือน)</label>
        <input type="number" class="form-input" id="el" value="${emp?.loan_monthly||0}" min="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">อีโมจิประจำตัว (ถ้ามี)</label>
      <input type="text" class="form-input" id="emj" value="${emp?.emoji||''}" placeholder="เช่น 👩🏻‍💼, 🧑🏻‍🔧" style="font-size:24px;text-align:center">
    </div>
    <div class="form-group">
      <label class="form-label">สีประจำตัว</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${clrs.map(c=>`<div class="color-swatch ${(emp?.avatar_color||clrs[0])===c?'selected':''}" data-color="${c}" style="background:${c}" onclick="pickColor(this,'${c}')"></div>`).join('')}
      </div>
      <input type="hidden" id="ec" value="${emp?.avatar_color||clrs[0]}">
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" style="flex:2;border-radius:var(--r-md)" onclick="submitEmp('${empId||''}')"><i class="fas fa-save"></i> บันทึก</button>
    </div>
  `);
}

/* ======= ACTIONS ======= */
function submitDraw(empId, maxAmount){
  const amount=parseFloat(v('drawAmount')), date=v('drawDate'), desc=(v('drawDesc')||'เบิกเงินสด').trim();
  if(!amount || amount<=0) {toast('กรุณาระบุจำนวนเงิน', 'error'); return;}
  if(amount > maxAmount) {toast('ยอดเบิก/หัก เกินจำนวนเงินที่ทำได้', 'error'); return;}
  DB.addDraw({employee_id:empId, date, amount, description:desc});
  toast('บันทึกรายการสำเร็จ ✅', 'success');
  closeModal();
  renderPage(S.page);
}
function deleteDraw(id){
  DB.deleteDraw(id);
  toast('ลบรายการแล้ว', 'info');
  renderPage(S.page);
}
function showDrawModal(id){
  const emp=DB.getEmployee(id);
  const st=Calc.earnedSoFar(id, S.pay.month, S.pay.year, todayKey());
  const maxDraw=st.max;
  openModal(`
    <div style="text-align:center;margin-bottom:20px">
      <div class="empty-icon-wrap" style="width:64px;height:64px;margin:0 auto 12px;background:var(--orange-bg);color:var(--orange);box-shadow:none"><i class="fas fa-hand-holding-usd"></i></div>
      <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em">เบิกเงิน / ลงบิล</div>
      <div style="font-size:13px;color:var(--t2);font-weight:600;margin-top:4px">${emp.name}</div>
    </div>
    <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:16px;margin-bottom:20px;position:relative;overflow:hidden">
      <div style="position:absolute;bottom:45px;left:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
      <div style="position:absolute;bottom:45px;right:-10px;width:20px;height:20px;border-radius:50%;background:var(--bg)"></div>
      <div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">สรุปยอด (รอบที่ ${st.cycle})</div>
      <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--t2);margin-bottom:8px">
        <span>ทำงานมาแล้ว ${st.days} วัน</span><span style="color:var(--t1);font-weight:700">${fmt.money(st.earned)}</span>
      </div>
      ${st.draws > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:var(--t2);margin-bottom:8px"><span>เบิกไปแล้ว</span><span style="color:var(--red);font-weight:700">- ${fmt.money(st.draws)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1.5px dashed var(--border);align-items:center">
        <span style="font-weight:800;color:var(--purple)">ยอดที่เบิกได้</span>
        <span style="color:var(--green);font-weight:900;font-size:24px;letter-spacing:-0.02em">${fmt.money(st.max)}</span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">รายการ</label>
      <input type="text" class="form-input" id="drawDesc" value="เบิกเงินสด" placeholder="เช่น ค่าชุดหมูกระทะ">
    </div>
    <div class="form-group">
      <label class="form-label">จำนวนเงิน (฿)</label>
      <input type="number" class="form-input" id="drawAmount" max="${maxDraw}" placeholder="0" oninput="if(this.value>${maxDraw})this.value=${maxDraw}">
    </div>
    <div class="form-group">
      <label class="form-label">วันที่</label>
      <input type="date" class="form-input" id="drawDate" value="${todayKey()}">
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" style="flex:2;border-radius:var(--r-md)" onclick="submitDraw('${id}', ${maxDraw})"><i class="fas fa-save"></i> บันทึก</button>
    </div>
  `);
}
function submitDay(empId,date){
  const status=v('dstatus'),lm=parseInt(v('dlate'))||0,otH=parseFloat(v('dot-h'))||0,otT=v('dot-t');
  const draw=parseFloat(v('ddraw'))||0;
  const note=(v('dnote')||'').trim(),rec=DB.getAttRec(empId,date)||{};
  DB.setAttRec(empId,date,{...rec,status,late_minutes:status==='late'?lm:0,ot_hours:otH,ot_type:otH>0?otT:null,note});
  if(draw>0){
    DB.addDraw({employee_id:empId, date, amount:draw, description:'เบิกเงิน (พร้อมลงเวลา)'});
  }
  toast('บันทึกการเข้างานสำเร็จ','success');closeModal();renderPage(S.page);
}
function quickSetStatus(empId,date,status){
  const rec=DB.getAttRec(empId,date)||{};
  DB.setAttRec(empId,date,{...rec,status,late_minutes:status==='late'?15:0});
  const lbl={present:'✅ มาทำงาน',late:'⏰ มาสาย',absent:'❌ ขาดงาน',sick_leave:'🏥 ลาป่วย',personal_leave:'📝 ลากิจ',annual_leave:'🏖️ พักร้อน',holiday:'🎌 วันหยุด'}[status]||status;
  toast(lbl,'success');renderPage('attendance');
}
function submitEmp(empId){
  const name=v('en')?.trim(),dept=v('ed')?.trim(),pos=v('ep')?.trim();
  const daily=parseFloat(v('es')),start=v('est'),phone=v('eph')?.trim(),bank=v('eb')?.trim();
  const dili=parseFloat(v('ea'))||0,loan=parseFloat(v('el'))||0,color=v('ec')||'#6C47FF';
  const emoji=v('emj')?.trim()||'';
  if(!name||!dept||!pos||!daily||daily<=0){toast('กรุณากรอกข้อมูลที่จำเป็น (*)','error');return;}
  const salary=daily*30;
  const data={name,department:dept,position:pos,base_salary:salary,start_date:start,phone,bank_account:bank,allowance_diligent:dili,loan_monthly:loan,avatar_color:color,emoji};
  if(empId){DB.updateEmployee(empId,data);toast('แก้ไขข้อมูลสำเร็จ ✅','success');}
  else{DB.addEmployee(data);toast('เพิ่มพนักงานสำเร็จ 🎉','success');}
  closeModal();renderPage(S.page);
}
function delEmpConfirm(id){
  openModal(`
    <div style="text-align:center;padding:16px 0">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--red-bg);margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
        <i class="fas fa-trash" style="font-size:24px;color:var(--red)"></i>
      </div>
      <div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:8px">ลบพนักงาน?</div>
      <div style="font-size:14px;color:var(--t2)">การกระทำนี้ไม่สามารถยกเลิกได้<br>ข้อมูลทั้งหมดจะถูกลบออก</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-neutral" style="flex:1;border-radius:var(--r-md)" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-danger" style="flex:1;border-radius:var(--r-md)" onclick="closeModal();DB.deleteEmployee('${id}');toast('ลบพนักงานสำเร็จ','success');navigate('employees')">ยืนยันลบ</button>
    </div>
  `);
}
function confirmPayroll(){toast(`✅ ยืนยันจ่ายเงินเดือน รอบ ${S.pay.cycle} สำเร็จ!`,'success');}

/* ======= STATE MUTATIONS ======= */
const attMode     =m=>{ S.att.mode=m; renderPage('attendance'); };
const attDateMove =d=>{ const dt=new Date(S.att.date+'T00:00:00'); dt.setDate(dt.getDate()+d); S.att.date=fmt.dateKey(dt); renderPage('attendance'); };
const attMonthMove=d=>{ let m=S.att.month+d,y=S.att.year; if(m>12){m=1;y++;}else if(m<1){m=12;y--;} S.att.month=m;S.att.year=y; renderPage('attendance'); };
const attEmpChange=id=>{ S.att.empId=id; renderPage('attendance'); };
const setExpFilter=f=>{ S.exp.filter=f; renderPage('expense'); };
const setPayCycle =c=>{ S.pay.cycle=c; renderPage('payroll'); };
const payMonthMove=d=>{ let m=S.pay.month+d,y=S.pay.year; if(m>12){m=1;y++;}else if(m<1){m=12;y--;} S.pay.month=m;S.pay.year=y; renderPage('payroll'); };
const empSearch   =q=>{ S.emp.search=q; renderPage('employees'); };
function viewEmpDetail(id){S.emp.selectedId=id;navigate('emp-detail');}

/* Modal helpers */
function toggleLateGrp(val){const el=document.getElementById('late-grp');if(el)el.style.display=val==='late'?'':'none';}
function updateOTPreview(sal){
  const h=parseFloat(document.getElementById('dot-h')?.value)||0;
  const t=document.getElementById('dot-t')?.value||'normal';
  const el=document.getElementById('ot-amt-disp'),box=document.getElementById('ot-preview');
  if(el)el.innerHTML=fmt.money(Math.round(Calc.otAmt(sal,h,t)));
  if(box)box.style.display=h>0?'':'none';
}
function pickColor(el,color){document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected');const inp=document.getElementById('ec');if(inp)inp.value=color;}

/* ======= HELPERS ======= */
const v=id=>document.getElementById(id)?.value;

function statusBadge(s){
  const m={
    present:'<span class="badge badge-approved">✅ มาทำงาน</span>',
    late:'<span class="badge badge-pending">⏰ มาสาย</span>',
    absent:'<span class="badge badge-rejected">❌ ขาดงาน</span>',
    sick_leave:'<span class="badge badge-paid">🏥 ลาป่วย</span>',
    personal_leave:'<span class="badge badge-paid">📝 ลากิจ</span>',
    annual_leave:'<span class="badge badge-draft">🏖️ พักร้อน</span>',
    holiday:'<span class="badge badge-draft">🎌 วันหยุด</span>',
    pending:'<span class="badge badge-pending">⏳ รออนุมัติ</span>',
    approved:'<span class="badge badge-approved">✅ อนุมัติ</span>',
    rejected:'<span class="badge badge-rejected">❌ ปฏิเสธ</span>',
  };
  return m[s]||`<span class="badge badge-draft">${s}</span>`;
}
function stColor(s){
  return{present:'var(--green)',late:'var(--yellow)',absent:'var(--red)',sick_leave:'var(--blue)',personal_leave:'var(--cyan)',annual_leave:'var(--purple)',holiday:'var(--t3)',none:'var(--t3)'}[s]||'var(--t3)';
}
function expCls(t){return{meal:'ic-yellow',travel:'ic-blue',misc:'ic-purple'}[t]||'ic-purple';}
function expEmoji(t){return{meal:'🍽️',travel:'🚗',misc:'📋'}[t]||'📋';}
function expLabel(t){return{meal:'ค่าอาหาร',travel:'ค่าเดินทาง',misc:'ค่าใช้จ่ายอื่น'}[t]||'ค่าใช้จ่าย';}

/* ======= TOAST ======= */
function toast(msg,type='info'){
  const box=document.getElementById('toast-box');
  const ic={success:'check-circle',error:'times-circle',warning:'exclamation-triangle',info:'info-circle'}[type];
  const el=document.createElement('div');
  el.className=`toast-msg toast-${type}`;
  el.innerHTML=`<i class="fas fa-${ic}"></i> ${msg}`;
  box.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s,transform .3s';el.style.opacity='0';el.style.transform='translateY(-8px)';setTimeout(()=>el.remove(),300);},2600);
}

/* ======= EVENTS ======= */
function bindEvents(){
  document.querySelectorAll('.bnav-btn').forEach(btn=>{btn.onclick=()=>navigate(btn.dataset.page);});
}

/* ======= PORTAL ======= */
function showQR(empId) {
  const emp = DB.getEmployee(empId);
  if (!emp) return;
  const url = window.location.href.split('?')[0] + '?emp=' + empId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
  
  document.getElementById('modal-body').innerHTML = `
    <div style="text-align:center;padding:10px 0 20px;">
      <h3 style="margin-bottom:16px;">QR Code ประจำตัว</h3>
      <img src="${qrUrl}" alt="QR" style="width:220px;height:220px;border-radius:12px;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:block;">
      <p style="margin-top:16px;font-size:14px;color:var(--t2);">ให้พนักงานสแกน QR นี้เพื่อเข้าสู่ระบบลงเวลาและดูยอดเงินของตัวเอง</p>
      <button class="btn btn-outline" style="width:100%;margin-top:20px;" onclick="closeModal()">ปิด</button>
    </div>
  `;
  document.getElementById('modal-sheet').classList.add('show');
  document.getElementById('modal-backdrop').classList.add('show');
}

function showSharedQR() {
  const url = window.location.href.split('?')[0] + '?portal=shared';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url);
  
  document.getElementById('modal-body').innerHTML = `
    <div style="text-align:center;padding:10px 0 20px;">
      <h3 style="margin-bottom:16px;">QR จุดลงเวลา (ส่วนกลาง)</h3>
      <img src="${qrUrl}" alt="QR" style="width:250px;height:250px;border-radius:12px;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:block;">
      <p style="margin-top:16px;font-size:14px;color:var(--t2);">ปริ้น QR นี้แปะไว้ที่ออฟฟิศ เพื่อให้พนักงานทุกคนสแกนลงเวลา</p>
      <button class="btn btn-primary" style="width:100%;margin-top:20px;padding:12px;border-radius:20px;font-size:16px;font-weight:bold;" onclick="closeModal()">ปิดหน้าต่างนี้</button>
    </div>
  `;
  document.getElementById('modal-sheet').classList.add('show');
  document.getElementById('modal-backdrop').classList.add('show');
}

function renderSharedPortal() {
  const emps = DB.getEmployees().filter(e => e.status === 'active');
  const $c = document.getElementById('content');
  
  const listHtml = emps.map(emp => `
    <div style="background:var(--surface);border-radius:var(--r-lg);padding:16px;margin-bottom:12px;display:flex;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.04);cursor:pointer;" onclick="renderPortal('${emp.id}', true)">
      <div class="avatar" style="background:${emp.avatar_color};margin-right:16px;">${emp.emoji||initials(emp.name)}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:16px;">${emp.name}</div>
        <div style="font-size:13px;color:var(--t2);">${emp.position}</div>
      </div>
      <i class="fas fa-chevron-right" style="color:var(--border);"></i>
    </div>
  `).join('');

  $c.innerHTML = `
    <div style="padding:20px; max-width:500px; margin:0 auto; padding-bottom:100px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="width:72px;height:72px;background:var(--blue);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;box-shadow:0 8px 24px var(--blue)55;">
          <i class="fas fa-fingerprint"></i>
        </div>
        <h2 style="margin:0;">จุดลงเวลาเข้าทำงาน</h2>
        <p style="color:var(--t2);margin:4px 0 0;">กรุณาเลือกชื่อของคุณจากรายการด้านล่าง</p>
      </div>
      <div style="margin-bottom:20px;">
        ${listHtml}
      </div>
    </div>
  `;
}

function renderPortal(empId, fromShared = false) {
  const emp = DB.getEmployee(empId);
  const $c = document.getElementById('content');
  if (!emp) {
    $c.innerHTML = '<div style="padding:40px;text-align:center;"><h3>ไม่พบข้อมูลพนักงาน</h3><p>รหัสนี้อาจถูกลบไปแล้ว</p></div>';
    return;
  }
  
  const m = currDt.getMonth() + 1;
  const y = currDt.getFullYear();
  const today = todayKey();
  const attRec = DB.getAttRec(empId, today);
  
  const st = Calc.earnedSoFar(empId, m, y, today);
  
  let attHtml = '';
  if (attRec) {
    let lbl = {present:'มาทำงาน',late:'มาสาย',absent:'ขาดงาน',sick_leave:'ลาป่วย',personal_leave:'ลากิจ',annual_leave:'พักร้อน',holiday:'วันหยุด'}[attRec.status]||attRec.status;
    let color = attRec.status==='present'?'var(--green)':attRec.status==='late'?'var(--orange)':'var(--red)';
    attHtml = `<div style="padding:16px;background:${color}15;color:${color};border-radius:12px;text-align:center;font-weight:bold;font-size:18px;">
      <i class="fas fa-check-circle"></i> วันนี้คุณลงเวลาแล้ว (${lbl})
    </div>`;
  } else {
    attHtml = `<button class="btn" style="width:100%;height:60px;font-size:18px;border-radius:20px;background:var(--blue);color:#fff;box-shadow:0 8px 24px var(--blue)40;" onclick="portalCheckIn('${empId}', ${fromShared})">
      <i class="fas fa-fingerprint" style="margin-right:8px;font-size:24px;vertical-align:-3px;"></i> ลงเวลาเข้าทำงานวันนี้
    </button>`;
  }

  $c.innerHTML = `
    <div style="padding:20px; max-width:500px; margin:0 auto; padding-bottom:100px;">
      ${fromShared ? `<div style="margin-bottom:20px;"><button class="btn btn-outline" style="padding:8px 16px;border-radius:20px;" onclick="renderSharedPortal()"><i class="fas fa-arrow-left"></i> กลับไปหน้ารายชื่อ</button></div>` : ''}
      <div style="text-align:center;margin-bottom:30px;">
        <div class="avatar av-xl" style="background:${emp.avatar_color};box-shadow:0 4px 20px ${emp.avatar_color}55;margin:0 auto 16px;">${emp.emoji||initials(emp.name)}</div>
        <h2 style="margin:0;">สวัสดี, ${emp.name.split(' ')[0]}</h2>
        <p style="color:var(--t2);margin:4px 0 0;">${emp.position}</p>
      </div>
      
      <div style="margin-bottom:30px;">
        ${attHtml}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;box-shadow:0 4px 16px rgba(0,0,0,.03);">
        <h3 style="margin:0 0 16px;font-size:16px;color:var(--t2);"><i class="fas fa-wallet"></i> กระเป๋าเงินของฉัน (รอบปัจจุบัน)</h3>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:15px;">
          <span>ทำงานสะสม</span><span style="font-weight:bold;">${st.days} วัน</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:15px;">
          <span>รายได้สะสม</span><span style="font-weight:bold;color:var(--green);">${fmt.money(st.earned)} ฿</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:15px;">
          <span>ยอดเบิก/หัก</span><span style="font-weight:bold;color:var(--red);">- ${fmt.money(st.draws)} ฿</span>
        </div>
        <hr style="border:none;border-top:1px dashed var(--border);margin:16px 0;">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;">
          <span>ยอดคงเหลือ</span><span style="color:var(--blue);">${fmt.money(st.max)} ฿</span>
        </div>
      </div>
    </div>
  `;
}

function portalCheckIn(empId, fromShared) {
  DB.setAttRec(empId, todayKey(), {status: 'present', late_minutes: 0, ot_hours: 0, ot_type: null, note: 'ลงเวลาผ่าน QR'});
  renderPortal(empId, fromShared);
  toast('ลงเวลาเข้าทำงานสำเร็จ!', 'success');
}

/* ======= INIT ======= */
async function init(){
  const urlParams = new URLSearchParams(window.location.search);
  const portalEmpId = urlParams.get('emp');
  const portalShared = urlParams.get('portal');

  const loaded = await cloudLoad();
  if(!loaded) seedData();
  setTimeout(()=>{const sp=document.getElementById('splash');if(sp){sp.classList.add('hide');setTimeout(()=>sp.remove(),450);}}, 800);
  
  if (portalEmpId || portalShared === 'shared') {
    const bnav = document.querySelector('.bottom-nav'); if (bnav) bnav.style.display = 'none';
    const tbar = document.querySelector('.topbar'); if (tbar) tbar.style.display = 'none';
    const ct = document.getElementById('content');
    ct.style.height = '100vh'; ct.style.paddingTop = '20px'; ct.style.paddingBottom = '20px';
    
    if (portalShared === 'shared') {
      renderSharedPortal();
    } else {
      renderPortal(portalEmpId, false);
    }
  } else {
    renderPage(S.page);
  }
}
window.addEventListener('DOMContentLoaded',init);
