/* ================================================================
 * 民族音乐页：渐变配色、民族卡片与库内视图、构建民族库
 * ----------------------------------------------------------------
 * 本文件由 mountainriverechoes.html 的内联 <script> 原样拆分而来，
 * 内容与顺序均未做任何修改（纯搬运）。加载顺序见 index.html。
 * ================================================================ */
/* ================================================================ 民族音乐(55个少数民族) */
const ETH_COLORS = [['#c21500', '#ffc500'], ['#8e2de2', '#4a00e0'], ['#136a8a', '#267871'], ['#cb2d3e', '#ef473a'],
  ['#f7971e', '#ffd200'], ['#654ea3', '#eaafc8'], ['#02aab0', '#00cdac'], ['#42275a', '#734b6d'],
  ['#20002c', '#cbb4d4'], ['#3a1c71', '#d76d77']];
const ETHNIC_ORDER = ['高山族'];   /* 专版: 配色次序表只保留高山族 */
/* 取「民族名(可带 · 后缀)」对应的多彩渐变, 与民族tab卡片同一套配色; 汉族单独用金色。
   name 形如 '蒙古族·民族音乐' 时自动按 '·' 前一段取色。 */
function ethGrad(name){
  const g = String(name || '').split('·')[0].trim();
  if (g === '汉族' || g === '汉族民间小调') return ['#8f5e0d', '#c9962c'];
  if (g === '高山族') return ['#c8202a', '#f2c14e'];   /* 专版: 高山族固定织带朱红+穗金 */
  const i = ETHNIC_ORDER.indexOf(g);
  return ETH_COLORS[(i < 0 ? 0 : i) % ETH_COLORS.length];
}
/* 向白色混合 k(0~1): 得到同一色相的淡色。卡片底色统一取淡色, 文字取本色(grad[0])保证可读。 */
function mixWhite(hex, k){
  const n = parseInt(String(hex).replace('#', ''), 16);
  const f = c => Math.round(c + (255 - c) * k);
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
    .map(x => x.toString(16).padStart(2, '0')).join('');
}
/* 卡片用淡色渐变(默认混白 68%); 横幅 .eth-head 等需要白字的场景仍用 ethGrad 本色。 */
function ethGradSoft(name, k){ const d = ethGrad(name); k = (k == null ? .68 : k); return [mixWhite(d[0], k), mixWhite(d[1], k)]; }
async function loadEthnos(){
  try {
    const d = await api('/api/ethnos');
    const prevDone = (state.ethnos.groups || []).filter(g => g.state === 'done').length;
    state.ethnos.groups = d.groups || []; state.ethnos.building = d.building; state.ethnos.hanDone = !!(d.han && d.han.done);
    state.hanInfo = d.han || state.hanInfo || {};
    if (d.done !== prevDone) state.index.data = null;   /* 新歌单构建完成 -> 索引需要刷新 */
    renderEthnos();
    clearTimeout(state.ethnos.timer);
    if (d.building) state.ethnos.timer = setTimeout(loadEthnos, 3000);
  } catch(err){}
}
function ethCardHTML(g){
  /* 配色统一走 ethGrad: 专版下高山族固定「织带朱红 + 穗金」, 与索引页民族卡完全一致;
     不再用 ci 下标取默认色环(会渲成紫色, 与主题两张皮)。 */
  const grad = ethGrad(g.name);
  const gs = [mixWhite(grad[0], .68), mixWhite(grad[1], .68)];   /* 淡色底 + 本色字 */
  /* 卡片上不再挂「N首」角标(密集), 只保留未构建/构建中这类状态提示; 曲目数在下方的 .nm 行 */
  const st = g.state === 'done' ? '' : (g.state === 'building' ? `<span class="st building">构建中</span>` : `<span class="st">未构建</span>`);
  const spin = g.state === 'building' ? `<span class="eth-spin"><span class="spin" style="width:18px;height:18px;border-width:2px;border-top-color:#ffd76e"></span></span>` : '';
  return `<div class="pl-card eth-card" data-k="${g.key}" data-nm="${esc(g.name)}">
    <div class="cov" style="background:linear-gradient(135deg,${gs[0]},${gs[1]});color:${grad[0]};text-shadow:none">${esc(g.name)}${st}${spin}<span class="play-cov"><svg class="ic fill"><use href="#i-play"/></svg></span></div>
    <div class="nm"><span>${esc(g.name)}音乐</span><span class="ct">${g.state === 'done' ? g.count + ' 首' : '点击构建'}</span></div></div>`;
}
function renderEthnos(){
  const groups = state.ethnos.groups || [];
  const done = groups.filter(g => g.state === 'done').length;
  const grid = $('#ethnos-grid');
  if (grid) {
    grid.innerHTML = groups.map(ethCardHTML).join('') || '<div class="empty">加载中...</div>';
  }
  const prog = $('#ethnos-progress');
  if (prog) {
    const building = state.ethnos.building;
    prog.style.display = 'none';   /* 单民族专版: 曲库已随安装包内置, 不存在「构建进度」 */
    $('#ethnos-fill').style.width = '100%';
    $('#ethnos-prog-text').textContent = '';
    $('#ethnos-stop').style.display = 'none';
  }
  $$('.eth-card[data-k]').forEach(card => card.onclick = async () => {
    const k = card.dataset.k;
    const g = (state.ethnos.groups || []).find(x => x.key === k);
    if (g && g.state === 'building') { toast('该民族歌单正在构建中...'); return; }
    if (g && g.state !== 'done') {
      toast(`开始构建「${g.name}」歌单，遍历音源搜索约需 30~60 秒`);
      try { await api('/api/ethnos/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group: k }) }); } catch(err){}
      loadEthnos();
    }
    nav('playlist', { id: k, platform: 'ethnos', name: card.dataset.nm + ' · 民族音乐' });
  });
  $$('.eth-card[data-more]').forEach(card => card.onclick = () => nav('ethnos'));
}
$('#ethnos-stop').onclick = async () => {
  try { await api('/api/ethnos/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }); toast('已请求停止，完成当前民族后停止'); } catch(err){}
};

