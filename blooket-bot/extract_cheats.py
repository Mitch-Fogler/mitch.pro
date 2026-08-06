import os
import re
import html
import urllib.parse

def find_bookmarks_file():
    for file in os.listdir("."):
        if file.endswith(".html"):
            return file
    return None

def parse_bookmarks_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            html_content = f.read()
    except Exception as e:
        print(f"[!] Error reading bookmarks file: {e}")
        return {}

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

def extract_core_js(js_code):
    match = re.search(r'const\s+(m|u|f)\s*=\s*(?:async\s*)?\(\s*\)\s*=>\s*\{', js_code)
    if not match:
        return js_code
        
    start_idx = match.end()
    brace_count = 1
    end_idx = start_idx
    while brace_count > 0 and end_idx < len(js_code):
        char = js_code[end_idx]
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
        end_idx += 1
        
    if brace_count == 0:
        body = js_code[start_idx:end_idx-1].strip()
        return f"(async () => {{\n{body}\n}})();"
    return js_code

def preprocess_cheat_js(js_code):
    robust_lookup = """(() => {
        const findReactNode = () => {
            let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
            const queue = [current];
            while (queue.length > 0) {
                const el = queue.shift();
                if (!el) continue;
                const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (reactKey) {
                    let fiber = el[reactKey];
                    const visited = new Set();
                    const fiberQueue = [fiber];
                    while (fiberQueue.length > 0) {
                        const node = fiberQueue.shift();
                        if (!node || visited.has(node)) continue;
                        visited.add(node);
                        
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
                        if (node.child) fiberQueue.push(node.child);
                        if (node.sibling) fiberQueue.push(node.sibling);
                        if (node.return) fiberQueue.push(node.return);
                    }
                }
                const children = Array.from(el.children);
                queue.push(...children);
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
    return js_code

def beautify_js(js):
    formatted = ""
    in_quotes = None
    i = 0
    indent_level = 0
    
    while i < len(js):
        char = js[i]
        if char in ('"', "'", "`") and (i == 0 or js[i-1] != '\\'):
            if in_quotes == char:
                in_quotes = None
            elif in_quotes is None:
                in_quotes = char
                
        if in_quotes:
            formatted += char
            i += 1
            continue
            
        if char == '{':
            indent_level += 1
            formatted += " {\n" + "    " * indent_level
        elif char == '}':
            indent_level = max(0, indent_level - 1)
            formatted = formatted.rstrip(" \t")
            if not formatted.endswith("\n"):
                formatted += "\n"
            formatted += "    " * indent_level + "}\n" + "    " * indent_level
        elif char == ';':
            formatted += ";\n" + "    " * indent_level
        elif char == ',':
            formatted += ", "
        else:
            if char == ' ' and (formatted.endswith(' ') or formatted.endswith('\n')):
                pass
            else:
                formatted += char
        i += 1
        
    lines = [line.rstrip() for line in formatted.splitlines() if line.strip()]
    clean_lines = []
    level = 0
    for line in lines:
        if line.startswith('}'):
            level = max(0, level - 1)
        clean_lines.append("    " * level + line.strip())
        if line.endswith('{'):
            level += 1
            
    return "\n".join(clean_lines)

def main():
    bookmarks_file = find_bookmarks_file()
    if not bookmarks_file:
        print("[!] No bookmarks HTML file found.")
        return
        
    print(f"[*] Found bookmarks file: {bookmarks_file}")
    bookmarklets = parse_bookmarks_file(bookmarks_file)
    
    for category, scripts in bookmarklets.items():
        cat_dir = os.path.join("cheats", category)
        os.makedirs(cat_dir, exist_ok=True)
        
        for name, href in scripts.items():
            js_code = href[11:] if href.startswith("javascript:") else href
            js_code = urllib.parse.unquote(js_code)
            
            # Extract core JS first
            core_js = extract_core_js(js_code)
            
            # Clean iframe overrides
            clean_js = preprocess_cheat_js(core_js)
            
            # Beautify
            beautiful_js = beautify_js(clean_js)
            
            # Clean filename
            filename = "".join([c for c in name if c.isalpha() or c.isdigit() or c in ' _-']).strip() + ".js"
            filepath = os.path.join(cat_dir, filename)
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(beautiful_js)
            print(f"[✓] Written clean script: {filepath}")

if __name__ == "__main__":
    main()
