#!/usr/bin/env python3
import curses, json, os, time, textwrap
from datetime import datetime, timezone, timedelta

BASE             = os.path.dirname(os.path.abspath(__file__))
SUGGESTIONS_FILE = os.path.join(BASE, 'data', 'suggestions.json')
NAMES_FILE       = os.path.join(BASE, 'data', 'names.json')
LA               = timezone(timedelta(hours=-7))

TYPE_LABELS = {'add_page': 'add page', 'broken_game': 'broken game', 'feedback': 'feedback'}

def fmt_time(ts):
    dt = datetime.fromtimestamp(ts, tz=LA)
    return dt.strftime('%m/%d %I:%M %p')

def load():
    try:    sugs  = json.load(open(SUGGESTIONS_FILE))
    except: sugs  = []
    try:    names = json.load(open(NAMES_FILE))
    except: names = {}
    # Update names from names file (fallback to stored name in entry)
    for s in sugs:
        s['_display'] = names.get(s.get('id',''), '') or s.get('name','') or s.get('id','?')[:20]
    return sugs

def sorted_entries(sugs):
    return sorted(sugs, key=lambda x: x.get('ts', 0), reverse=True)

def detail_view(stdscr, entry):
    text  = entry.get('text', '')
    name  = entry['_display']
    stype = TYPE_LABELS.get(entry.get('type',''), entry.get('type',''))
    ts    = fmt_time(entry.get('ts', 0))
    offset = 0

    while True:
        H, W = stdscr.getmaxyx()
        stdscr.erase()

        header = f' {name}  [{stype}]  {ts} '
        stdscr.addstr(0, 0, header[:W-1], curses.color_pair(1) | curses.A_BOLD)

        # Word-wrap text to terminal width
        wrap_w = W - 4
        lines = []
        for para in text.split('\n'):
            if para.strip():
                lines.extend(textwrap.wrap(para, wrap_w) or [''])
            else:
                lines.append('')

        visible_h = H - 3
        total = len(lines)
        offset = max(0, min(offset, max(0, total - visible_h)))

        for row, line in enumerate(lines[offset: offset + visible_h]):
            stdscr.addstr(row + 1, 2, line[:W-3])

        scroll = f' {offset+1}-{min(offset+visible_h, total)}/{total} ' if total > visible_h else ''
        status = f' [↑↓/PgUp/PgDn] scroll  [q/Esc] back{scroll.rjust(max(0, W-1-30))}'
        stdscr.addstr(H-1, 0, status[:W-1], curses.color_pair(3))
        stdscr.refresh()

        key = stdscr.getch()
        if key in (ord('q'), 27, curses.KEY_LEFT): break
        elif key in (curses.KEY_UP, ord('k')):    offset = max(0, offset - 1)
        elif key in (curses.KEY_DOWN, ord('j')):  offset = min(max(0, total - visible_h), offset + 1)
        elif key == curses.KEY_PPAGE:             offset = max(0, offset - visible_h)
        elif key == curses.KEY_NPAGE:             offset = min(max(0, total - visible_h), offset + visible_h)
        elif key == ord('g'):                     offset = 0
        elif key == ord('G'):                     offset = max(0, total - visible_h)

def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(1, curses.COLOR_CYAN,   -1)
    curses.init_pair(2, curses.COLOR_BLACK,  curses.COLOR_CYAN)
    curses.init_pair(3, curses.COLOR_YELLOW, -1)
    curses.init_pair(4, curses.COLOR_GREEN,  -1)
    curses.init_pair(5, curses.COLOR_RED,    -1)

    sel = 0; off = 0

    TYPE_COLORS = {'add_page': 4, 'broken_game': 5, 'feedback': 1}

    while True:
        sugs    = load()
        entries = sorted_entries(sugs)
        H, W    = stdscr.getmaxyx()
        stdscr.erase()

        sel = max(0, min(sel, len(entries) - 1))
        list_h = H - 2
        if sel < off:           off = sel
        if sel >= off + list_h: off = sel - list_h + 1

        col_name = max(14, W // 4)
        col_type = 13
        col_time = 15

        # Header
        try:
            hdr = 'NAME'.ljust(col_name) + 'TYPE'.ljust(col_type) + 'TIME'.ljust(col_time) + 'PREVIEW'
            stdscr.addstr(0, 0, hdr[:W-1], curses.A_BOLD)
        except curses.error: pass

        if not entries:
            stdscr.addstr(2, 2, 'No suggestions yet.', curses.color_pair(3))
        else:
            for row, e in enumerate(entries[off: off + list_h]):
                i    = row + off
                sel_ = i == sel
                attr = curses.color_pair(2) if sel_ else 0
                tcol = TYPE_COLORS.get(e.get('type',''), 1)

                name_s = e['_display'][:col_name-1].ljust(col_name)
                type_s = TYPE_LABELS.get(e.get('type',''), e.get('type',''))[:col_type-1].ljust(col_type)
                time_s = fmt_time(e.get('ts',0))[:col_time-1].ljust(col_time)
                prev_w = max(0, W - col_name - col_type - col_time - 1)
                prev_s = e.get('text','').replace('\n',' ')[:prev_w]

                try: stdscr.addstr(row+1, 0, name_s, attr)
                except curses.error: pass
                try: stdscr.addstr(row+1, col_name, type_s, curses.color_pair(2) if sel_ else curses.color_pair(tcol))
                except curses.error: pass
                try: stdscr.addstr(row+1, col_name+col_type, time_s, attr)
                except curses.error: pass
                try: stdscr.addstr(row+1, col_name+col_type+col_time, prev_s, attr)
                except curses.error: pass

        total_str = f' {len(entries)} suggestion(s) '
        status = f' [↑↓] nav  [Enter] read  [q] quit{total_str.rjust(max(0, W-1-30))}'
        stdscr.addstr(H-1, 0, status[:W-1], curses.color_pair(3))
        stdscr.refresh()
        stdscr.timeout(3000)
        key = stdscr.getch()

        if key in (ord('q'), ord('Q')): break
        elif key == curses.KEY_UP:   sel = max(0, sel - 1)
        elif key == curses.KEY_DOWN: sel = min(len(entries)-1, sel+1) if entries else 0
        elif key in (curses.KEY_ENTER, 10, 13):
            if entries: detail_view(stdscr, entries[sel])

curses.wrapper(main)
