import argparse
import asyncio
import json
import os
import html
import urllib.request
import urllib.error
import urllib.parse
from urllib.parse import urlparse
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
import sys

class InputRouter:
    def __init__(self):
        self.dialog_waiter = None  # Future for dialog input
        self.menu_waiter = None    # Future for menu input
        self.other_players = []
        self.auto_mode = None
        self.auto_val = "1000"
        
    async def start(self):
        loop = asyncio.get_running_loop()
        while True:
            # Read line from stdin in a separate thread
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line:
                await asyncio.sleep(0.1)
                continue
            line = line.strip()
            
            # Route the input prioritizing browser dialogs
            if self.dialog_waiter and not self.dialog_waiter.done():
                self.dialog_waiter.set_result(line)
            elif self.menu_waiter and not self.menu_waiter.done():
                self.menu_waiter.set_result(line)

    async def get_menu_input(self, prompt_text):
        print(prompt_text, end="", flush=True)
        self.menu_waiter = asyncio.get_running_loop().create_future()
        try:
            return await self.menu_waiter
        finally:
            self.menu_waiter = None
            
    async def get_dialog_input(self, prompt_text):
        print(prompt_text, end="", flush=True)
        self.dialog_waiter = asyncio.get_running_loop().create_future()
        try:
            return await self.dialog_waiter
        finally:
            self.dialog_waiter = None

input_router = InputRouter()

def preprocess_cheat_js(js_code):
    import re
    
    robust_lookup = """(() => {
        const findReactNode = () => {
            const elements = [
                document.querySelector("#app"),
                document.querySelector("#root"),
                document.body,
                ...Array.from(document.querySelectorAll("div"))
            ];
            for (const el of elements) {
                if (!el) continue;
                const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (!key) continue;
                let node = el[key];
                while (node) {
                    const props = node.memoizedProps || node.pendingProps;
                    if (props?.liveGameController) {
                        if (node.stateNode && !(node.stateNode instanceof HTMLElement)) {
                            return node.stateNode;
                        }
                        return {
                            props: props,
                            state: node.memoizedState || {},
                            setState: function(newState) {
                                Object.assign(this.state, newState);
                            }
                        };
                    }
                    node = node.return;
                }
            }
            return null;
        };
        return findReactNode();
    })()"""

    pattern = r'Object\.values\(\s*function\s+e\s*\(\s*t\s*=\s*document\.querySelector\(\s*["\']body\s*>\s*div["\']\s*\)\s*\)\s*\{\s*return\s+Object\.values\(\s*t\s*\)\[1\]\?\.children\?\.\[0\]\?\._owner\.stateNode\?t:e\(\s*t\.querySelector\(\s*["\']:scope\s*>\s*div["\']\s*\)\s*\)\s*\}\s*\(\s*\)\s*\)\[1\]\.children\[0\]\._owner'
    js_code = re.sub(pattern, f"({{ stateNode: {robust_lookup} }})", js_code)

    # 1. Bypass contentWindow.bind overrides
    js_code = re.sub(
        r'[a-zA-Z0-9_]+\.contentWindow\.(prompt|alert|confirm)\.bind\(\s*window\s*\)',
        r'window.\1',
        js_code
    )
    # 2. Bypass iframe selection alert/confirm references
    js_code = re.sub(
        r'document\.querySelector\(\s*["\']iframe["\']\s*\)\.contentWindow\.(alert|confirm|prompt)',
        r'window.\1',
        js_code
    )
    # 3. Make all setState calls safe using optional chaining
    js_code = js_code.replace('.setState(', '.setState?.(')
    return js_code

def resolve_cheat_js(category, name, fallback_js_code):
    import os
    if category:
        clean_filename = "".join([c for c in name if c.isalpha() or c.isdigit() or c in ' _-']).strip() + ".js"
        clean_file = os.path.join("cheats", category.lower(), clean_filename)
        if os.path.exists(clean_file):
            try:
                with open(clean_file, "r", encoding="utf-8") as f:
                    print(f"[*] Loaded clean JS cheat from: {clean_file}")
                    return f.read()
            except Exception as e:
                print(f"[!] Warning: Failed to read clean JS cheat file: {e}")
    
    # Fallback
    print("[*] Falling back to bookmarklet JS code...")
    js_code = fallback_js_code
    if js_code.startswith("javascript:"):
        js_code = js_code[11:]
    import urllib.parse
    js_code = urllib.parse.unquote(js_code)
    return preprocess_cheat_js(js_code)

SUBDOMAIN_GAME_MODES = {
    "cryptohack": "Crypto Hack",
    "crypto": "Crypto Hack",
    "goldquest": "Gold Quest",
    "gold": "Gold Quest",
    "candyquest": "Gold Quest",
    "shamrockquest": "Gold Quest",
    "cafe": "Cafe",
    "factory": "Factory",
    "racing": "Racing",
    "defense": "Tower Defense",
    "towerdefense": "Tower Defense",
    "towerdefense2": "Tower Defense 2",
    "rush": "Blook Rush",
    "blookrush": "Blook Rush",
    "fishing": "Fishing Frenzy",
    "fish": "Fishing Frenzy",
    "fishingfrenzy": "Fishing Frenzy",
    "dino": "Deceptive Dinos",
    "dinos": "Deceptive Dinos",
    "deceptivedinos": "Deceptive Dinos",
    "royale": "Battle Royale",
    "battleroyale": "Battle Royale",
    "classic": "Classic",
    "brawl": "Monster Brawl",
    "monsterbrawl": "Monster Brawl",
    "pirate": "Pirate's Voyage",
    "santa": "Santa's Workshop",
    "doom": "Tower of Doom",
    "kingdom": "Crazy Kingdom",
    "crazykingdom": "Crazy Kingdom",
}

INTERNAL_GAME_MODES = {
    "hack": "Crypto Hack",
    "gold": "Gold Quest",
    "candy": "Gold Quest",
    "cafe": "Cafe",
    "factory": "Factory",
    "defense": "Tower Defense",
    "defense2": "Tower Defense 2",
    "fish": "Fishing Frenzy",
    "dino": "Deceptive Dinos",
    "toy": "Santa's Workshop",
    "rush": "Blook Rush",
    "royale": "Battle Royale",
    "brawl": "Monster Brawl",
    "pirate": "Pirate's Voyage",
    "racing": "Racing",
    "classic": "Classic",
    "doom": "Tower of Doom",
    "kingdom": "Crazy Kingdom"
}

def find_bookmarks_file():
    for file in os.listdir("."):
        if file.endswith(".html"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "<H3" in content and "HREF=" in content:
                        return file
            except Exception:
                pass
    return None

def parse_bookmarks_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            html_content = f.read()
    except Exception as e:
        print(f"[!] Error reading bookmarks file: {e}")
        return {}

    import re
    lines = html_content.splitlines()
    folder_stack = []
    bookmarklets = {}
    in_blooket = False
    blooket_depth = 0

    for line in lines:
        line = line.strip()
        if not line:
            continue

        h3_match = re.search(r"<H3[^>]*>(.*?)</H3>", line, re.IGNORECASE)
        a_match = re.search(r"<A\s+HREF=\"([^\"]+)\"[^>]*>(.*?)</A>", line, re.IGNORECASE)
        dl_start = re.search(r"<DL>", line, re.IGNORECASE)
        dl_end = re.search(r"</DL>", line, re.IGNORECASE)

        if h3_match:
            folder_name = h3_match.group(1).strip()
            folder_stack.append(folder_name)
            if folder_name.lower() == "blooket":
                in_blooket = True
                blooket_depth = len(folder_stack)
        elif dl_start:
            pass
        elif dl_end:
            if folder_stack:
                closed_folder = folder_stack.pop()
                if in_blooket and len(folder_stack) < blooket_depth:
                    in_blooket = False
        elif a_match:
            href = a_match.group(1).strip()
            name = html.unescape(a_match.group(2).strip())
            
            if in_blooket and href.startswith("javascript:"):
                blooket_idx = -1
                for idx, f_name in enumerate(folder_stack):
                    if f_name.lower() == "blooket":
                        blooket_idx = idx
                        break
                
                if blooket_idx != -1 and blooket_idx + 1 < len(folder_stack):
                    category_parts = [html.unescape(part) for part in folder_stack[blooket_idx + 1:]]
                    category = "/".join(category_parts).lower()
                else:
                    category = "global"

                if category not in bookmarklets:
                    bookmarklets[category] = {}
                bookmarklets[category][name] = href

    return bookmarklets

def get_flaresolverr_cookies(url, solver_url="http://localhost:8191/v1"):
    print(f"[*] Requesting Cloudflare bypass from FlareSolverr ({solver_url})...")
    payload = {
        "cmd": "request.get",
        "url": url,
        "maxTimeout": 60000
    }
    req = urllib.request.Request(
        solver_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=70) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get("status") == "ok":
                return res_data["solution"]
            raise Exception(f"FlareSolverr returned status: {res_data.get('status')}. Msg: {res_data.get('message')}")
    except Exception as e:
        raise RuntimeError(f"Failed to get cookies from FlareSolverr: {e}")

async def detect_gamemode_and_started(page):
    url = page.url
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    path = parsed.path or ""
    
    # Check if we are actually on a Blooket play page
    if "/play" not in path:
        return "Disconnected / Home Page", False

    started = True
    if "/play/lobby" in path or "/play/register" in path:
        started = False

    detected_mode = None

    # 1. Try to query the React stateNode directly
    try:
        internal_mode = await page.evaluate("""
            (() => {
                try {
                    const r = function e(t=document.querySelector("body>div")){return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))}();
                    const node = Object.values(r)[1].children[0]._owner.stateNode;
                    return node.props.client?.gameMode || node.props.gameMode || node.state?.gameMode || node.props.client?.game || null;
                } catch(e) {
                    return null;
                }
            })()
        """)
        if internal_mode:
            internal_mode = str(internal_mode).lower()
            if internal_mode in INTERNAL_GAME_MODES:
                detected_mode = INTERNAL_GAME_MODES[internal_mode]
    except Exception:
        pass

    # 2. Fall back to subdomain checks
    if not detected_mode:
        subdomain = hostname.split('.')[0].lower()
        if subdomain in SUBDOMAIN_GAME_MODES:
            detected_mode = SUBDOMAIN_GAME_MODES[subdomain]
            
    # 3. Fall back to path keyword checks
    if not detected_mode:
        for keyword, mode_name in SUBDOMAIN_GAME_MODES.items():
            if keyword in path.lower():
                detected_mode = mode_name
                break
                
    # 4. Fall back to lobby innerText parsing
    if not detected_mode and not started:
        detected_mode = "Unknown (Lobby)"
        try:
            page_text = await page.evaluate("document.body.innerText")
            for mode_name in set(SUBDOMAIN_GAME_MODES.values()):
                if mode_name.lower() in page_text.lower():
                    detected_mode = mode_name
                    break
        except Exception:
            pass
            
    if not detected_mode:
        detected_mode = "Instructions / Starting" if "/play/instructions" in path else "Unknown Mode"
        
    return detected_mode, started

async def monitor_lobby_state(page):
    last_mode = None
    last_started = None
    while True:
        try:
            gamemode, started = await detect_gamemode_and_started(page)
            if gamemode != last_mode or started != last_started:
                status_str = "Started" if started else "In Lobby"
                print(f"\n[*] State Update: Game Mode = '{gamemode}' | Status = {status_str} | URL = {page.url}")
                last_mode = gamemode
                last_started = started
                
            # Periodically query other players to avoid blocking during dialogs
            other_players = await page.evaluate("""
                (() => {
                    try {
                        const r = function e(t=document.querySelector("body>div")){return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))}();
                        const node = Object.values(r)[1].children[0]._owner.stateNode;
                        const db = node.props.liveGameController.database || {};
                        const players = Object.keys(db.c || {});
                        const myName = node.props.client.name;
                        return players.filter(p => p && p.toLowerCase() !== myName.toLowerCase());
                    } catch(e) {
                        try {
                            const r = function e(t=document.querySelector("body>div")){return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))}();
                            const node = Object.values(r)[1].children[0]._owner.stateNode;
                            const players = Object.keys(node.state.players || {});
                            const myName = node.props.client.name;
                            return players.filter(p => p && p.toLowerCase() !== myName.toLowerCase());
                        } catch(err) {
                            return [];
                        }
                    }
                })()
            """)
            if other_players:
                input_router.other_players = other_players
        except Exception:
            pass
        await asyncio.sleep(2)

async def handle_browser_dialog(dialog):
    print(f"\n[Browser Dialog] {dialog.type.upper()}: {dialog.message}")
    
    # Auto response if --auto flag is active
    auto_mode = getattr(input_router, "auto_mode", None)
    if auto_mode:
        print(f"[*] Auto responding to browser dialog ({dialog.type.upper()})")
        if dialog.type == "alert":
            await dialog.accept()
        elif dialog.type == "confirm":
            await dialog.accept()
        elif dialog.type == "prompt":
            msg = dialog.message.lower()
            # If the prompt asks for a player's name (e.g. steal/swap/reset cheats)
            if any(kw in msg for kw in ["who", "player", "steal", "swap", "reset"]):
                import random
                players = getattr(input_router, "other_players", [])
                if players:
                    val = random.choice(players)
                else:
                    val = "Teacher"
            else:
                if auto_mode == "win":
                    val = "999999999999999"
                elif auto_mode == "win-incremental":
                    val = getattr(input_router, "auto_val", "1000")
                else:
                    val = "100"
            print(f"[*] Auto input: '{val}'")
            await dialog.accept(val)
        return

    # Manual response
    if dialog.type == "alert":
        await dialog.accept()
    elif dialog.type == "confirm":
        ans = await input_router.get_dialog_input("Confirm? (y/n): ")
        if ans.strip().lower() in ["y", "yes"]:
            await dialog.accept()
        else:
            await dialog.dismiss()
    elif dialog.type == "prompt":
        default_val = dialog.default_value or ""
        prompt_msg = f"Enter value (default: '{default_val}'): " if default_val else "Enter value: "
        ans = await input_router.get_dialog_input(prompt_msg)
        if not ans.strip() and default_val:
            ans = default_val
        await dialog.accept(ans)

async def terminal_console(page, bookmarklets):
    current_page = "game_specific"  # Options: "game_specific", "global_page_1", "global_page_2", "global_intervals"
    
    while True:
        try:
            # Resolve current game category dynamically
            gamemode, started = await detect_gamemode_and_started(page)
            game_cat = None
            for cat in bookmarklets.keys():
                if cat.lower() in gamemode.lower() or gamemode.lower() in cat.lower():
                    game_cat = cat
                    break
            
            # Prepare script groups
            game_scripts = sorted(bookmarklets.get(game_cat, {}).items()) if game_cat else []
            
            # Find global scripts
            global_scripts_all = sorted(bookmarklets.get("global", {}).items())
            global_scripts_p1 = global_scripts_all[:8]
            global_scripts_p2 = global_scripts_all[8:]
            
            # Find interval scripts
            interval_cat = None
            for cat in bookmarklets.keys():
                if "interval" in cat.lower():
                    interval_cat = cat
                    break
            interval_scripts = sorted(bookmarklets.get(interval_cat, {}).items()) if interval_cat else []
            
            # Print current menu
            print("\n==================================================")
            if current_page == "game_specific":
                title = f"{gamemode.upper()} CHEATS" if game_cat else "GAME CHEATS"
                print(f"               {title}")
                print("==================================================")
                if game_scripts:
                    for i, (name, _) in enumerate(game_scripts, 1):
                        print(f"  {i}. {name}")
                else:
                    print("  (No cheats found for this game mode.)")
                print("--------------------------------------------------")
                print("  0. Global Cheats Page 1")
                
            elif current_page == "global_page_1":
                print("               GLOBAL CHEATS - PAGE 1")
                print("==================================================")
                for i, (name, _) in enumerate(global_scripts_p1, 1):
                    print(f"  {i}. {name}")
                print("--------------------------------------------------")
                print("  0. Next Page (Global Page 2)")
                
            elif current_page == "global_page_2":
                print("               GLOBAL CHEATS - PAGE 2")
                print("==================================================")
                for i, (name, _) in enumerate(global_scripts_p2, 1):
                    print(f"  {i}. {name}")
                print("--------------------------------------------------")
                print("  9. Open Interval Cheats Folder")
                print("  0. Back to Game-Specific Cheats")
                
            elif current_page == "global_intervals":
                print("               GLOBAL INTERVAL CHEATS")
                print("==================================================")
                if interval_scripts:
                    for i, (name, _) in enumerate(interval_scripts, 1):
                        print(f"  {i}. {name}")
                else:
                    print("  (No interval cheats found.)")
                print("--------------------------------------------------")
                print("  0. Back to Global Page 2")
            print("==================================================")
            
            # Get user choice using input router
            choice = await input_router.get_menu_input("Select option: ")
            choice = choice.strip()
            if not choice:
                continue
                
            # Handle menu navigation
            if choice == "0":
                if current_page == "game_specific":
                    current_page = "global_page_1"
                elif current_page == "global_page_1":
                    current_page = "global_page_2"
                elif current_page == "global_page_2":
                    current_page = "game_specific"
                elif current_page == "global_intervals":
                    current_page = "global_page_2"
                continue
                
            if current_page == "global_page_2" and choice == "9":
                current_page = "global_intervals"
                continue
                
            # Handle script selection
            try:
                idx = int(choice) - 1
            except ValueError:
                print("[!] Invalid input. Please enter a number.")
                continue
                
            # Resolve script based on current page
            selected_script = None
            if current_page == "game_specific":
                if 0 <= idx < len(game_scripts):
                    selected_script = game_scripts[idx]
            elif current_page == "global_page_1":
                if 0 <= idx < len(global_scripts_p1):
                    selected_script = global_scripts_p1[idx]
            elif current_page == "global_page_2":
                if 0 <= idx < len(global_scripts_p2):
                    selected_script = global_scripts_p2[idx]
            elif current_page == "global_intervals":
                if 0 <= idx < len(interval_scripts):
                    selected_script = interval_scripts[idx]
                    
            if selected_script:
                name, js_code = selected_script
                print(f"\n[*] Executing script: '{name}'...")
                
                cat_name = None
                if current_page == "game_specific":
                    cat_name = game_cat
                elif current_page in ("global_page_1", "global_page_2"):
                    cat_name = "global"
                elif current_page == "global_intervals":
                    cat_name = interval_cat
                    
                js_run = resolve_cheat_js(cat_name, name, js_code)
                
                try:
                    await page.evaluate(js_run)
                    print(f"[✓] Executed '{name}'.")
                except Exception as e:
                    print(f"[!] Error: {e}")
            else:
                print("[!] Invalid option number.")
                
        except (KeyboardInterrupt, EOFError):
            print("\n[*] Exiting console.")
            break
        except Exception as e:
            print(f"[!] Console error: {e}")

async def auto_actions_loop(page, bookmarklets, auto_mode):
    print(f"[*] Auto Action Loop started with mode: '{auto_mode}'")
    target_val = 1000
    
    # Wait for the game to start
    in_lobby_logged = False
    while True:
        try:
            gamemode, started = await detect_gamemode_and_started(page)
            if started:
                break
            if not in_lobby_logged:
                print("[*] Currently in lobby. Waiting for the host to start the game...")
                in_lobby_logged = True
        except Exception:
            pass
        await asyncio.sleep(1)
        
    print(f"[*] Game started! Running auto actions for mode: '{auto_mode}'...")
    
    if auto_mode == "crash":
        print("[*] Triggering client-side memory crash...")
        try:
            await page.evaluate("let s = 'x'; while(true) { s += s; }")
        except Exception as e:
            print(f"[*] Tab crashed successfully: {e}")
        return
        
    # Periodic loops for win, win-incremental, and troll
    while True:
        try:
            gamemode, started = await detect_gamemode_and_started(page)
            if not started:
                await asyncio.sleep(2)
                continue
                
            # Find current game category
            game_cat = None
            for cat in bookmarklets.keys():
                if cat.lower() in gamemode.lower() or gamemode.lower() in cat.lower():
                    game_cat = cat
                    break
                    
            if not game_cat:
                await asyncio.sleep(2)
                continue
                
            scripts = bookmarklets.get(game_cat, {})
            
            if auto_mode == "win":
                # Find the win script
                win_keywords = ["set gold", "set crypto", "set cash", "set fossils", "set weight", "instant win", "set toys", "set tokens", "set coins", "set score", "set blooks"]
                win_script_js = None
                win_script_name = None
                for name, js in scripts.items():
                    if any(kw in name.lower() for kw in win_keywords):
                        win_script_js = js
                        win_script_name = name
                        break
                        
                if win_script_js:
                    print(f"[*] Auto Win: Executing win script...")
                    js_run = resolve_cheat_js(game_cat, win_script_name, win_script_js)
                    await page.evaluate(js_run)
                    print("[✓] Auto Win script executed. Terminating auto win loop.")
                    break
                else:
                    print("[!] No win script found for this mode.")
                    
            elif auto_mode == "win-incremental":
                # Double the score
                target_val *= 2
                input_router.auto_val = str(target_val)
                
                # Find the set script
                set_keywords = ["set gold", "set crypto", "set cash", "set fossils", "set weight", "set toys", "set tokens", "set coins", "set score", "set blooks"]
                set_script_js = None
                set_script_name = None
                for name, js in scripts.items():
                    if any(kw in name.lower() for kw in set_keywords):
                        set_script_js = js
                        set_script_name = name
                        break
                        
                if set_script_js:
                    print(f"[*] Auto Win-Incremental: Setting value to {target_val}...")
                    js_run = resolve_cheat_js(game_cat, set_script_name, set_script_js)
                    await page.evaluate(js_run)
                
            elif auto_mode == "troll":
                # Find troll script
                troll_keywords = ["remove customers", "send glitch", "send distraction", "reset players gold", "swap gold", "swap toys", "steal players crypto", "take doubloons", "swap doubloons"]
                troll_script_js = None
                troll_script_name = None
                for name, js in scripts.items():
                    if any(kw in name.lower() for kw in troll_keywords):
                        troll_script_js = js
                        troll_script_name = name
                        break
                        
                if troll_script_js:
                    print(f"[*] Auto Troll: Running troll script '{troll_script_name}'...")
                    js_run = resolve_cheat_js(game_cat, troll_script_name, troll_script_js)
                    await page.evaluate(js_run)
                else:
                    print("[!] No troll script found for this mode.")
                    
        except Exception as e:
            print(f"[!] Error in auto action loop: {e}")
            
        await asyncio.sleep(3)

async def run_single_bot(p, name, args, bookmarklets, is_main=False, on_join_success=None):
    JOIN_URL = f"https://play.blooket.com/play?id={args.pin}"
    try:
        # Request separate FlareSolverr cookies and User-Agent for this bot instance asynchronously
        loop = asyncio.get_running_loop()
        solution = await loop.run_in_executor(None, get_flaresolverr_cookies, JOIN_URL, args.solver_url)
        cookies = solution.get("cookies", [])
        user_agent = solution.get("userAgent")
    except Exception as e:
        print(f"[!] Warning: Bot '{name}' failed to bypass Cloudflare via FlareSolverr: {e}. Attempting with default user agent...")
        cookies = []
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    # Launch browser
    browser = await p.chromium.launch(headless=args.headless, args=["--disable-blink-features=AutomationControlled", "--no-sandbox"])
    try:
        context = await browser.new_context(user_agent=user_agent, viewport={"width": 1280, "height": 720})
        if cookies:
            await context.add_cookies([{"name": c["name"], "value": c["value"], "domain": c["domain"], "path": c["path"]} for c in cookies])
        
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)
        
        # Only register manual dialog handler on the main bot, otherwise auto-accept on flood bots
        if is_main:
            page.on("dialog", lambda dialog: asyncio.create_task(handle_browser_dialog(dialog)))
        else:
            page.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))
            
        await page.goto(JOIN_URL, wait_until="load")
        await asyncio.sleep(3)
        
        # Join sequence
        name_input = page.locator("input[type='text'], input[placeholder*='Name'], input[placeholder*='Nickname']")
        await name_input.fill(name)
        join_button = page.locator("button[type='submit'], div[role='button'], .joinButton")
        if await join_button.count() > 0:
            await join_button.first.click()
        else:
            await name_input.press("Enter")
            
        print(f"[*] Bot '{name}' submitting join request...")
        
        # Wait for redirect to complete
        joined = False
        for _ in range(20):
            url = page.url
            if "/lobby" in url or "/register" in url or "/instructions" in url or (("blooket.com" in url) and ("?id=" not in url) and ("?" not in url)):
                joined = True
                break
            await asyncio.sleep(0.5)
            
        if joined:
            print(f"[✓] Bot '{name}' successfully joined lobby!")
            if on_join_success:
                on_join_success()
        else:
            print(f"[!] Bot '{name}' failed to join (timeout).")
            return False
            
        if not is_main and not args.keep_browser:
            # Destroy browser immediately after joining
            print(f"[*] Destroying browser for flood bot '{name}' as requested.")
            return True
            
        if is_main:
            # Main bot handles console and monitor
            monitor_task = asyncio.create_task(monitor_lobby_state(page))
            auto_task = None
            if args.auto:
                auto_task = asyncio.create_task(auto_actions_loop(page, bookmarklets, args.auto))
                
            await terminal_console(page, bookmarklets)
            
            if auto_task:
                auto_task.cancel()
            monitor_task.cancel()
        else:
            # Flood bot with keep-browser: keep alive in the background
            while True:
                await asyncio.sleep(10)
    except Exception as e:
        print(f"[!] Error in bot '{name}': {e}")
    finally:
        await browser.close()

async def flood_manager(p, args, bookmarklets):
    X = args.flood[0]
    Y = args.flood[1] if len(args.flood) > 1 else None
    
    bot_counter = 2
    joined_count = 1
    active_tasks = set()
    
    def increment_joined():
        nonlocal joined_count
        joined_count += 1
        print(f"[*] Total joined bots: {joined_count}" + (f" / {Y}" if Y is not None else ""))

    try:
        while True:
            if Y is not None and joined_count >= Y:
                # Wait forever or until cancelled to keep the browsers alive if keep_browser is set
                if args.keep_browser:
                    print(f"[✓] Flood target Y={Y} reached! Keeping browsers active...")
                    while True:
                        await asyncio.sleep(10)
                else:
                    break
                
            # Clean finished tasks
            finished = {t for t in active_tasks if t.done()}
            active_tasks -= finished
            
            slots_available = X - len(active_tasks)
            if Y is not None:
                remaining_needed = Y - joined_count - len(active_tasks)
                slots_available = min(slots_available, remaining_needed)
                
            for _ in range(slots_available):
                if Y is not None and (joined_count + len(active_tasks)) >= Y:
                    break
                    
                bot_name = f"{args.name}{bot_counter}"
                bot_counter += 1
                
                task = asyncio.create_task(
                    run_single_bot(p, bot_name, args, bookmarklets, is_main=False, on_join_success=increment_joined)
                )
                active_tasks.add(task)
                await asyncio.sleep(0.5)
                
            if Y is not None and joined_count >= Y and not args.keep_browser:
                break
                
            await asyncio.sleep(0.1)
    finally:
        # Cancel all running bots when the manager completes or is cancelled
        if active_tasks:
            print("[*] Cleaning up background tasks...")
            for t in active_tasks:
                t.cancel()
            await asyncio.gather(*active_tasks, return_exceptions=True)

async def main():
    parser = argparse.ArgumentParser(description="CLI Blooket Bot.")
    parser.add_argument("--pin", type=str, default="7174055", help="Blooket Game PIN")
    parser.add_argument("--name", type=str, default="AutomatedBot", help="Bot Nickname")
    parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    parser.add_argument("--solver-url", type=str, default="http://localhost:8191/v1", help="FlareSolverr URL")
    parser.add_argument("--auto", type=str, choices=["win", "win-incremental", "troll", "crash"], help="Auto run action when game starts")
    parser.add_argument("--flood", type=int, nargs="+", help="Spawns X browsers at once (first parameter) until Y joined (optional second parameter). If Y is omitted, runs indefinitely.")
    parser.add_argument("--keep-browser", action="store_true", default=False, help="Keep flood browser instances open")
    args = parser.parse_args()

    # Start the stdin router task in the background
    router_task = asyncio.create_task(input_router.start())
    
    try:
        bookmarks_file = find_bookmarks_file()
        bookmarklets = parse_bookmarks_file(bookmarks_file) if bookmarks_file else {}

        # Always try to load the standalone Blooket Utility GUI (New) bookmarklet
        gui_file = "cheat-blooket-gui.bookmarklet.js"
        gui_file_path = gui_file
        if not os.path.exists(gui_file_path):
            gui_file_path = os.path.join(os.path.dirname(__file__), gui_file)
        
        if os.path.exists(gui_file_path):
            try:
                with open(gui_file_path, "r", encoding="utf-8") as f:
                    gui_js = f.read().strip()
                    if gui_js:
                        if not gui_js.startswith("javascript:"):
                            gui_js = "javascript:" + gui_js
                        if "global" not in bookmarklets:
                            bookmarklets["global"] = {}
                        bookmarklets["global"]["00. Blooket Utility GUI (New)"] = gui_js
                        print(f"[*] Successfully integrated Blooket Utility GUI (New) bookmarklet from {gui_file_path}")
            except Exception as e:
                print(f"[!] Warning: Failed to load GUI bookmarklet file: {e}")
        else:
            print(f"[!] Warning: GUI bookmarklet file not found at {gui_file_path}")

        # Set auto_mode in input_router
        input_router.auto_mode = args.auto

        async with async_playwright() as p:
            if args.flood:
                # Start flood manager in the background
                flood_task = asyncio.create_task(
                    flood_manager(p, args, bookmarklets)
                )
                try:
                    # Run the main bot in the foreground
                    await run_single_bot(p, f"{args.name}1", args, bookmarklets, is_main=True)
                finally:
                    # When main bot exits, cancel the flood manager and all its running bots
                    flood_task.cancel()
                    try:
                        await flood_task
                    except asyncio.CancelledError:
                        pass
            else:
                # Just run the main bot
                await run_single_bot(p, args.name, args, bookmarklets, is_main=True)
    finally:
        router_task.cancel()

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: print("\n[*] Disconnected.")
