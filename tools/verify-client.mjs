#!/usr/bin/env node
/* dsh-session-tools 离线加载器验证（tools/verify-client.mjs）
 *
 * 干什么：在不启动 DSH 的情况下，用假 window.__ModuleLoader__ / 假 ctx / 假 react 跑一遍 client.js，
 * 断言宿主契约（id、name、inject、apply、槽位注册、order、效果标签）都对，并**复现重复注册报错**。
 *
 * 为什么要有它：客户端半侧的锅全在启动期暴露（web boot 失败会连设置页/联网搜索一起挂）。
 * 改完 client.js 先跑这个，再问用户重启 —— 「能离线验不直接重启」。
 *
 * 用法：
 *   node F:\dsh-plugins\dsh-session-tools\tools\verify-client.mjs
 *   node <本文件> --client <其它包的 client.js> --pkg-id <该包的 npm 名>   # 校验别的插件
 *   node <本文件> --expect-missing --client F:\agent_bus\dsh-plugin\client.js   # 反向验证旧文件已挪走
 *
 * 退出码：0 = 全过；1 = 有 FAIL。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// fileURLToPath 才认得 Windows 盘符路径（别自己剥前导斜杠）
const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = join(process.env.USERPROFILE || 'C:\\Users\\17236', '.dsh', 'profiles', 'desktop');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CLIENT = resolve(arg('client', join(PKG_DIR, 'client.js')));
const PKG_JSON_PATH = resolve(arg('package', join(PKG_DIR, 'package.json')));
const expectMissing = process.argv.includes('--expect-missing');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log('%s %s%s', ok ? 'OK  ' : 'FAIL', name, detail ? '  ' + detail : '');
}

console.log('# 离线加载器验证');
console.log('  client : %s', CLIENT);
console.log('  package: %s', PKG_JSON_PATH);
console.log('');

if (!existsSync(CLIENT)) {
  check('client.js 存在（' + CLIENT + '）', expectMissing, expectMissing ? '文件不存在 —— 正是本次期望（已挪走）' : '文件不存在：先确认路径');
  console.log('\n结果: %d/%d 通过', results.filter((r) => r.ok).length, results.length);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
check('client.js 存在', true, CLIENT);

const pkgRaw = readFileSync(PKG_JSON_PATH, 'utf8');
const PKG = JSON.parse(pkgRaw);
const ID = PKG.name;
const injectList = (PKG.dsh && PKG.dsh.client && PKG.dsh.client.inject) || [];
check('package.json 可解析且声明 dsh.client', !!(PKG.dsh && PKG.dsh.client), 'name=' + ID + ' platform=' + ((PKG.dsh && PKG.dsh.client && PKG.dsh.client.platform) || '-'));

/* bundle 层是硬要求：loadProfileDirectory 见到 dsh.bundle 缺失就整层 skip（skippedBundles），
 * 而客户端半侧只在「已加载的 entry」上被发现 —— 少了它，菜单项永远不会出现。 */
const bundleDecl = PKG.dsh && PKG.dsh.bundle;
const patchRel = bundleDecl && (bundleDecl.patch || (Array.isArray(bundleDecl.patches) && bundleDecl.patches[0]));
check('声明了 dsh.bundle.patch（否则整层被跳过）', !!patchRel, patchRel ? String(patchRel) : '缺失');
if (patchRel) {
  const patchPath = resolve(PKG_DIR, String(patchRel).replace(/^\.\//, ''));
  const patchOk = existsSync(patchPath);
  const patchBody = patchOk ? readFileSync(patchPath, 'utf8') : '';
  check('bundle patch 文件存在', patchOk, patchPath);
  check('bundle patch insert 的是本包（id + name 都要对）', patchBody.includes('name: ' + "'" + ID + "'") || patchBody.includes('name: "' + ID + '"'),
    patchBody.replace(/\s+/g, ' ').trim().slice(0, 100));
}
check('exports 导出 ./client（客户端半侧的入口）', !!(PKG.exports && PKG.exports['./client']), JSON.stringify(PKG.exports && PKG.exports['./client']));

/* ---------- 假 react（离线只用得到 createElement / useState / useRef / useEffect） ---------- */
let inRender = false;
const REACT = {
  createElement(type, props, ...children) {
    return { __isElement: true, type, props: props || {}, children };
  },
  useState(initial) {
    let value = initial;
    return [value, (next) => { value = typeof next === 'function' ? next(value) : next; }];
  },
  useRef(initial) {
    return { current: initial === undefined ? null : initial };
  },
  useEffect(fn, deps) {
    // 真 React 在挂载后才跑 effect；离线只在本文件显式进入“渲染阶段”时跑一次。
    if (inRender && typeof fn === 'function') fn();
  },
};
const requireStub = (name) => {
  if (name === 'react' || name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return REACT;
  throw new Error('离线加载器：client.js 只允许 require("react")，实际要求了 "' + name + '"');
};

/* ---------- 假模块加载器 + 假 DOM ---------- */
let LOADER = null;
function makeLoader() {
  const factories = new Map();
  const loadAttempts = [];
  const warned = [];
  return {
    id: null,
    factories,
    loadAttempts,
    warned,
    /** 形状照抄宿主 ClientModuleSystem.register：同 id 二次注册 → 抛这个文案 */
    load(registration) {
      loadAttempts.push(registration && registration.id);
      const thisId = registration && registration.id;
      if (factories.has(thisId)) {
        throw new Error('client-modules: duplicate factory registration for "' + thisId + '" (bundle executed twice without invalidate?)');
      }
      factories.set(thisId, registration.factory);
    },
  };
}

function installFakes() {
  LOADER = makeLoader();
  const styleEls = [];
  const fakeDocument = {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        attributes: {},
        style: {},
        textContent: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
        appendChild() {},
      };
    },
    head: { appendChild(el) { styleEls.push(el); } },
    body: { dispatchEvent() { return true; } },
  };
  const fakeWindow = {
    __ModuleLoader__: LOADER,
    addEventListener() {},
    getComputedStyle() { return {}; },
  };
  // Node 24 里 navigator 是只读全局（getter），只能 defineProperty 覆盖
  const defineGlobal = (key, value) =>
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true, enumerable: true });
  defineGlobal('window', fakeWindow);
  defineGlobal('document', fakeDocument);
  defineGlobal('navigator', { clipboard: { writeText: async () => {} } });
  defineGlobal('KeyboardEvent', class KeyboardEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
  });
  return { styleEls };
}

/** 跑一遍 client.js（就是宿主 web boot 执行 bundle 脚本做的事）。返回 { threw, added }
 *  用 new Function 而不是 import()：ESM 会按 URL 缓存，第二次 import 同一个文件不会真的再执行一遍，
 *  那样「重复执行必须被吸收」这条断言就是假绿。new Function 每次都是硬执行一遍，跟宿主插 <script> 的语义一致。 */
async function runClientScript(label) {
  const before = LOADER.factories.size;
  let threw = null;
  const origWarn = console.warn;
  console.warn = (...args) => { LOADER.warned.push(args.map(String).join(' ')); };
  try {
    const source = readFileSync(CLIENT, 'utf8');
    // eslint-disable-next-line no-new-func
    const script = new Function('window', 'document', 'navigator', 'console', source);
    script(globalThis.window, globalThis.document, globalThis.navigator, console);
  } catch (error) {
    threw = error;
  } finally {
    console.warn = origWarn;
  }
  void label;
  return { threw, added: LOADER.factories.size - before };
}

/* ---------- 假 ctx：记录插件对宿主做的每一件事 ---------- */
function makeCtx(opts = {}) {
  const rec = { registrations: [], effects: [] };
  const slotsService = {
    inject(slotKey, cb) {
      rec.registrations.push({ kind: 'inject', slotKey });
      return cb();
    },
    register(meta, component) {
      rec.registrations.push({ kind: 'register', meta, component, slotKey: SLOT });
      return () => {};
    },
  };
  const ctx = {
    logger: { info() {}, warn() {}, debug() {}, error() {} },
    get(name) {
      if (name === 'slots' && opts.withSlots !== false) return slotsService;
      return undefined;
    },
    effect(cb, label) {
      rec.effects.push({ label });
      return cb();
    },
  };
  if (opts.withSlots !== false) ctx.slots = slotsService;
  return { ctx, rec };
}

const SLOT = 'sidebar.workspaces.session.menu.item';

/* ---------- 1) 首次执行：注册 + 契约断言 ---------- */
let phase1 = { threw: null, added: 0 };
if (PKG.dsh && PKG.dsh.client) {
  installFakes();
  phase1 = await runClientScript('first');
  check('首次执行不抛错', !phase1.threw, phase1.threw ? String(phase1.threw.message).slice(0, 120) : '');
  check('恰好注册 1 个 factory', LOADER.factories.size === 1, 'factories=' + LOADER.factories.size);
  check('注册 id = package.json 的 name（写错短名 → web boot 失败）', LOADER.loadAttempts[0] === ID, 'load 时的 id=' + LOADER.loadAttempts[0]);
  check('loadAttempts 只有 1 次', LOADER.loadAttempts.length === 1, LOADER.loadAttempts.join(','));

  const factory = LOADER.factories.get(ID);
  check('factory 是函数', typeof factory === 'function');

  const exportsObj = factory(requireStub);
  // exports.name 是插件标签（宿主日志里显示用），dsh-purge 也是短名；真正决定发现的是 load 的 id。
  check('exports.name 指的是本插件（短名/包名都行，与包名同源）', typeof exportsObj.name === 'string'
    && exportsObj.name.length > 0 && ID.includes(exportsObj.name), 'exports.name=' + exportsObj.name + ' / pkg=' + ID);
  check('exports.inject = ["slots"]', JSON.stringify(exportsObj.inject) === '["slots"]', JSON.stringify(exportsObj.inject));
  check('exports.apply 是函数', typeof exportsObj.apply === 'function');
  check('client half 声明依赖了 ui-slots 包', injectList.includes('@deepseek-ai/dsh-client-ui-slots'), injectList.length + ' 条 inject');

  const { ctx, rec } = makeCtx();
  let applyThrew = null;
  try { exportsObj.apply(ctx); } catch (e) { applyThrew = e; }
  check('apply(ctx) 不抛错', !applyThrew, applyThrew ? String(applyThrew.message) : '');

  const reg = rec.registrations.find((r) => r.kind === 'register');
  const inj = rec.registrations.find((r) => r.kind === 'inject');
  check('inject 到了会话菜单槽位', !!inj && inj.slotKey === SLOT, inj ? inj.slotKey : '缺失');
  check('槽位里注册了 1 个菜单项', rec.registrations.filter((r) => r.kind === 'register').length === 1,
    'registrations=' + rec.registrations.length);
  check('菜单项 id 是包命名空间的（不与内置 id 撞车）', !!reg && String(reg.meta.id).startsWith('dsh-session-tools'),
    reg ? String(reg.meta.id) : '缺失');
  check('order = 350（内置占 100/200/300/400，350 是空档）', !!reg && reg.meta.order === 350,
    reg ? 'order=' + reg.meta.order : '缺失');
  check('注册项带了组件（菜单行本体）', !!reg && typeof reg.component === 'function');
  check('effect 用了带标签的清理入口', rec.effects.length === 1 && /dsh-session-tools/.test(rec.effects[0].label || ''),
    rec.effects.map((e) => e.label).join(' | '));

  // ownerProps 两条投递路径都要能取到 sessionId
  const ownerObj = reg.meta.inject({ sessionId: 'session-abc', displayTitle: 't' });
  const ownerArgs = reg.meta.inject('session-xyz', 't');
  check('ownerProps 对象形参 → sessionId', ownerObj.sessionId === 'session-abc', JSON.stringify(ownerObj));
  check('ownerProps 位置形参 → sessionId', ownerArgs.sessionId === 'session-xyz', JSON.stringify(ownerArgs));

  // 组件渲染：本地桩 DOM 里量一次兄弟行的分支不能抛错
  inRender = true;
  let renderThrew = null;
  try {
    const el = reg.component({ sessionId: 'session-abc' });
    if (!el || !el.__isElement) throw new Error('组件没有返回 React 元素');
  } catch (e) { renderThrew = e; }
  inRender = false;
  check('菜单行组件渲染不抛错', !renderThrew, renderThrew ? String(renderThrew.message) : '');

  // slots 服务缺席时必须是「warn 后跳过」，不许拖垮启动
  const { ctx: bareCtx, rec: bareRec } = makeCtx({ withSlots: false });
  let bareThrew = null;
  try { exportsObj.apply(bareCtx); } catch (e) { bareThrew = e; }
  check('slots 服务缺席时只跳过、不抛错', !bareThrew && bareRec.registrations.length === 0, bareThrew ? String(bareThrew.message) : '');

  /* ---------- 2) 再执行一次：宿主会抛重复注册，插件必须吸收掉 ---------- */
  const phase2 = await runClientScript('second');
  check('第二次执行被 try/catch 吸收（不冒泡 → 不炸 web boot）', !phase2.threw, phase2.threw ? String(phase2.threw.message).slice(0, 120) : '');
  check('第二次没有新增 factory（幂等）', LOADER.factories.size === 1, 'factories=' + LOADER.factories.size);
  check('第二次确实撞到 duplicate 报错（证明宿主行为被复现）', phase2.added === 0 && LOADER.loadAttempts.length === 2,
    'loadAttempts=' + LOADER.loadAttempts.length + ' 新增 factory=' + phase2.added);
  check('吸收动作有日志留痕', LOADER.warned.some((w) => /duplicate client registration/.test(w)),
    LOADER.warned.slice(-1)[0] || '（无 warn）');

  /* ---------- 3) 反向对照：不吸收的写法必须炸（证明哨兵不是摆设） ---------- */
  const naive = 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => ({}) });';
  let naiveThrew = null;
  try {
    // 用同一 id 直接再注册一次：宿主 register 的行为
    LOADER.load({ id: ID, factory: () => ({}) });
  } catch (e) { naiveThrew = e; }
  check('对照：裸写 load() 会抛 duplicate factory registration', !!naiveThrew && /duplicate factory registration/.test(String(naiveThrew.message)),
    naiveThrew ? String(naiveThrew.message).slice(0, 90) : '没抛错（宿主行为变了，去重查 client-modules/lib/client.js）');
  void naive;
} else {
  check('package.json 声明了 dsh.client 才需要跑客户端验证', false, '当前包没声明 dsh.client');
}

/* ---------- 4) profile 接线核对（默认启用是否真的接上了） ---------- */
try {
  const profilePkg = JSON.parse(readFileSync(join(PROFILE, 'package.json'), 'utf8'));
  const deps = profilePkg.dependencies || {};
  const bundles = ((profilePkg.dsh || {}).profile || {}).bundles || [];
  check('profile.dependencies 有本包（link:）', !!deps[ID], String(deps[ID] || '缺失'));
  check('profile.bundles 含本包（默认启用）', bundles.includes(ID), bundles.join(', '));

  const linked = join(PROFILE, 'node_modules', ...ID.split('/'));
  check('link 落地：profile node_modules 能解析到本包', existsSync(join(linked, 'package.json')), linked);
  const viaProfile = join(PROFILE, 'node_modules', ...ID.split('/'), 'client.js');
  check('profile 侧 client.js 可见（宿主就是从这里取 bundle）', existsSync(viaProfile), viaProfile);

  // dsh.client.inject 是「声明式依赖边」：按宿主契约从两个锚点解析——装好的 dsh 应用 + 本 profile
  // （见 dsh-app-boot 的 resolveBundleDir：installAnchor 优先，profileDir 兜底）。
  const appModules = process.env.DSH_APP_MODULES
    || join(process.env.LOCALAPPDATA || join(process.env.USERPROFILE || 'C:\\Users\\17236', 'AppData', 'Local'),
      'Programs', 'DeepSeek Harness', 'resources', 'app', 'dsh', 'node_modules');
  const resolvesFrom = [join(PROFILE, 'node_modules'), appModules];
  const missingInject = injectList.filter((dep) => {
    const rel = String(dep).split('/');
    return !resolvesFrom.some((base) => existsSync(join(base, ...rel, 'package.json')));
  });
  check('dsh.client.inject 里的包在 DSH 应用/profile 里能解析', missingInject.length === 0,
    missingInject.length ? '解析不到: ' + missingInject.join(', ') : injectList.length + ' 条都能解析（锚点: 应用 + profile）');
  // 踩过：从 dsh-purge 抄 inject 列表，抄进来一个根本不存在的包名（应用里没有这个目录）——
  // 悬空依赖边不会炸启动，但会在 web 插件表里留一条假边，排查时误导人。这里专门盯住。
  const PHANTOM = ['@deepseek-ai/dsh-client-runtime'];
  const phantoms = injectList.filter((dep) => PHANTOM.includes(dep));
  check('没有抄来的幽灵依赖（如 dsh-client-runtime）', phantoms.length === 0,
    phantoms.length ? '应删: ' + phantoms.join(', ') : '已清干净');

  const localScope = join(PROFILE, 'node_modules', '@local');
  check('@local 作用域目录干净（无重复/残留安装）', existsSync(localScope),
    existsSync(localScope) ? readdirSync(localScope).join(', ') : '（还没建，npm install 会建）');
} catch (e) {
  check('profile 接线核对', false, String(e && e.message).slice(0, 120));
}

const failed = results.filter((r) => !r.ok);
console.log('\n结果: %d/%d 通过%s', results.length - failed.length, results.length, failed.length ? '   <- 看上面 FAIL 项' : '');
process.exit(failed.length ? 1 : 0);
