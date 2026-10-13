/* dsh-session-tools —— 客户端半侧（web）
 * 唯一功能：会话「...」菜单里加一行「复制会话 ID」（从 @local/agent-bus 拆出，二者互不依赖）。
 *
 * 防重：同一个 bundle 若被执行两次（HMR/重复装载），重复注册错误会被吸收；
 * 这样既不让 web boot 失败，也允许 loader 失效后重新注册新的 factory。
 *
 * 样式对齐：按宿主 ui-primitives 的 Menu.module.css 原值写死（13px/20px/34px/6px 8px/gap 6px/图标 14px），
 * 并在挂载后再"量一次兄弟菜单项"的实际样式覆盖，保证 dense/compact 变体下也一致。
 */
(function () {
	if (typeof window === "undefined") return;
	if (!window.__ModuleLoader__ || typeof window.__ModuleLoader__.load !== "function") return;

	try {
		window.__ModuleLoader__.load({ id: "dsh-session-tools", factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const h = react.createElement;

		const name = "dsh-session-tools";
		const inject = ["slots"];
		const SLOT = "sidebar.workspaces.session.menu.item";
		const MENU_ID = "dsh-session-tools-copy-id";
		const LABEL = "\u590d\u5236\u4f1a\u8bdd ID";
		const CLS = "dsh-session-tools-menu-item";

		/* 宿主 Menu.module.css 的原值（dense 30px / compact 24px 由运行时测量覆盖）
		 * 注意：这里刻意不写 background —— 内联样式会压过类规则，悬浮高亮就没了（踩过）。 */
		const BASE = {
			display: "flex", alignItems: "center", gap: "6px", width: "100%",
			minHeight: "34px", padding: "6px 8px", border: "none",
			borderRadius: "var(--dsw-radius-md)",
			cursor: "pointer", fontSize: "13px", lineHeight: "20px",
			color: "var(--dsw-alias-label-primary)", textAlign: "left",
			fontFamily: "inherit", boxSizing: "border-box",
		};
		const ICON = { width: "14px", height: "14px", flex: "0 0 auto", display: "inline-flex",
			alignItems: "center", justifyContent: "center",
			color: "var(--dsw-alias-menu-icon, var(--dsw-alias-label-secondary))" };

		/* 悬浮色带回退：--dsw-alias-interactive-bg-hover 不在公开 token 表里，缺了就退到 layer-2 / 半透明灰 */
		const HOVER_BG = "var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2, rgba(127,127,127,.16)))";
		const CSS = "." + CLS + "{background:transparent}"
			+ "." + CLS + ":hover:not(:disabled){background:" + HOVER_BG + "}"
			+ "." + CLS + ":focus-visible:not(:disabled){background:" + HOVER_BG + ";outline:none}";

		/* 一个 14px 的复制图标（stroke 用 currentColor，跟随 --dsw-alias-menu-icon） */
		function CopyIcon() {
			return h("span", { style: ICON, "aria-hidden": "true" },
				h("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none",
						stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" },
					h("rect", { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1.6" }),
					h("path", { d: "M10.5 5.5V3.9A1.4 1.4 0 0 0 9.1 2.5H3.9A1.4 1.4 0 0 0 2.5 3.9v5.2a1.4 1.4 0 0 0 1.4 1.4h1.6" })
				));
		}

		function extract(props) {
			if (!props) return { sid: "" };
			const sid = props.sessionId || (props.session && props.session.id) || "";
			return { sid: String(sid) };
		}

		function CopyIdItem(props) {
			const got = extract(props);
			const state = react.useState(LABEL);
			const label = state[0];
			const setLabel = state[1];
			const btn = react.useRef(null);
			const iconBox = react.useRef(null);

			/* 挂载后：量一次兄弟菜单项，把真实计算样式覆盖过来（dense/compact 也能跟） */
			react.useEffect(() => {
				const el = btn.current;
				if (!el || !el.parentElement) return;
				let sib = null;
				const rows = el.parentElement.querySelectorAll('[role="menuitem"]');
				for (let k = 0; k < rows.length; k++) {
					if (rows[k] !== el) { sib = rows[k]; break; }
				}
				if (!sib) return;
				/* 1) 直接继承宿主那一行的 class → 连它自己的悬浮/焦点高亮也一起拿到（最稳） */
				try {
					const sibCls = (sib.getAttribute("class") || "").trim();
					const mine = el.getAttribute("class") || "";
					if (sibCls && mine.indexOf(sibCls) < 0) el.setAttribute("class", mine + " " + sibCls);
				} catch (e) { /* ignore */ }
				/* 2) 再量一次计算样式覆盖尺寸/字色（dense/compact 变体也能跟） */
				const cs = window.getComputedStyle(sib);
				["fontSize", "fontFamily", "fontWeight", "lineHeight", "minHeight", "paddingTop",
					"paddingBottom", "paddingLeft", "paddingRight", "gap", "borderRadius", "color"]
					.forEach((k) => { if (cs[k]) el.style[k] = cs[k]; });
				if (iconBox.current) {
					const iconEl = sib.querySelector("svg");
					if (iconEl) {
						const r = iconEl.getBoundingClientRect();
						if (r.width > 4) {
							iconBox.current.style.width = Math.round(r.width) + "px";
							iconBox.current.style.height = Math.round(r.height) + "px";
						}
					}
				}
			}, []);

			const copyText = (text) => {
				try {
					if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
						navigator.clipboard.writeText(text);
						return true;
					}
				} catch (e) { /* 掉到 prompt */ }
				try { window.prompt("手动复制：", text); return true; } catch (e2) { return false; }
			};

			const onClick = () => {
				if (!got.sid) { setLabel("拿不到会话 ID"); setTimeout(() => setLabel(LABEL), 1200); return; }
				const ok = copyText(got.sid);
				setLabel(ok ? "已复制 \u2713" : "复制失败");
				try {
					document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
				} catch (e) { /* 菜单关不掉就算了 */ }
				setTimeout(() => setLabel(LABEL), 1000);
			};

			return h("button", {
				ref: btn, type: "button", role: "menuitem", className: CLS,
				style: BASE, title: got.sid || "把这条会话的 session id 复制到剪贴板", onClick,
			},
				h("span", { ref: iconBox, style: ICON }, h(CopyIcon)),
				h("span", { style: { flex: "1 1 auto", minWidth: 0 } }, label));
		}

		function apply(ctx) {
			const styleEl = document.createElement("style");
			styleEl.setAttribute("data-dsh-session-tools", "menu-item");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);

			const slots = ctx.slots || (typeof ctx.get === "function" ? ctx.get("slots") : null);
			if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") {
				try { console.warn("[dsh-session-tools] slots service unavailable, menu item skipped"); } catch (e) { /* ignore */ }
				return;
			}
			ctx.effect(() => slots.inject(SLOT, () => slots.register({
				name: SLOT,
				id: MENU_ID,
				order: 350,
				inject: function () {
					const a = Array.prototype.slice.call(arguments);
					if (a.length === 1 && a[0] && typeof a[0] === "object") {
						return { sessionId: a[0].sessionId, displayTitle: a[0].displayTitle };
					}
					return { sessionId: a[0], displayTitle: a[1] };
				},
			}, CopyIdItem)), "dsh-session-tools: 复制会话 ID");
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
		}});
	} catch (error) {
		/* 重复脚本执行是 HMR/批量 bundle 的可恢复情况；已注册的 factory 仍然可用。 */
		const message = String(error && error.message ? error.message : error);
		if (!message.includes("duplicate factory registration")) throw error;
		try { console.warn("[dsh-session-tools] duplicate client registration ignored"); } catch (e) { /* ignore */ }
	}
})();
