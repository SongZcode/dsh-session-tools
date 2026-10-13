/* dsh-session-tools —— 宿主半侧（最小化）
 *
 * 本插件真正干活的全在客户端半侧（client.js）。宿主这半边刻意什么都不注册：
 * 没有命令、没有 HTTP 口、没有后台任务 —— 注册了平台已有的东西就是重复造轮子。
 * 留这个文件是为了：① package.json 的 "." 入口有个能 unapply 的干净模块；
 * ② 启动日志里能一眼看出本插件被加载了（排查"菜单项不出现"时省一步）。
 *
 * 用法提醒：本插件默认启用由 profile 的 dsh.profile.bundles 决定，不要把它加进 hmr.root
 * （HMR 与 loader 叠加会重复执行 bundle → duplicate factory registration，曾导致 web boot 失败）。
 */

export const name = 'dsh-session-tools';

export function apply(ctx) {
  const logger = ctx && ctx.logger;
  if (logger && typeof logger.info === 'function') {
    logger.info('dsh-session-tools: host half ready (菜单项由客户端半侧注册)');
  }

  const slots = ctx && typeof ctx.get === 'function' ? ctx.get('slots') : undefined;
  // 宿主侧没有要注册的槽位：这句只在有人误把客户端逻辑搬过来时提醒一下。
  if (logger && typeof logger.debug === 'function') {
    logger.debug('dsh-session-tools: host slots service ' + (slots ? 'available (unused)' : 'absent (expected)'));
  }

  // 干净的可回收点：卸载时什么都不用拆。
  ctx.effect(() => () => {
    if (logger && typeof logger.debug === 'function') logger.debug('dsh-session-tools: host half disposed');
  }, 'dsh-session-tools: host no-op');
}
