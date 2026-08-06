(async () =>  {
    let o=(() =>  {
        const findReactNode = () =>  {
            let root = document.querySelector("body>div");
            const queue = [root];
            while (queue.length > 0)  {
                const el = queue.shift();
                if (!el) continue;
                const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (reactKey)  {
                    const fiber = el[reactKey];
                    let candidate = fiber?.child;
                    while (candidate)  {
                        if (candidate.stateNode && (candidate.stateNode.setState || candidate.stateNode.props?.liveGameController))  {
                            return candidate.stateNode;
                            }
                            candidate = candidate.sibling || candidate.child;
                            }
                            const stateNode = fiber?.child?.stateNode || fiber?.memoizedProps?.liveGameController?._owner?.stateNode || fiber?.return?.stateNode;
                            if (stateNode) return stateNode;
                            }
                            const children = Array.from(el.children);
                            queue.push(...children);
                            }
                            let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
                            const reactKey = Object.keys(current).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                            if (reactKey)  {
                                let fiber = current[reactKey];
                                while (fiber)  {
                                    if (fiber.stateNode && (fiber.stateNode.setState || fiber.stateNode.props?.liveGameController))  {
                                        return fiber.stateNode;
                                        }
                                        fiber = fiber.return;
                                        }
                                        }
                                        return null;
                                        }
                                        ;
                                        return findReactNode();
                                        }
                                        )(), n=["materials", "people", "happiness", "gold"], c=Array.prototype.reduce.call(document.querySelectorAll("[class*=statContainer]"), (e, t, o)=>(e[n[o]]=t, e),  {
                                            }
                                            );
                                            "choice"==o.state.phase&&(Array.prototype.forEach.call(document.querySelectorAll(".choiceESP"), e=>e.remove()), Object.keys(o.state.guest.yes|| {
                                                }
                                                ).forEach(e=> {
                                                    var t;
                                                    null!=c[e]&&((t=document.createElement("div")).className="choiceESP", t.style="font-size: 24px; color: rgb(75, 194, 46); font-weight: bolder;", t.innerText=String(o.state.guest.yes[e]), c[e].appendChild(t))
                                                    }
                                                    ), Object.keys(o.state.guest.no|| {
                                                        }
                                                        ).forEach(e=> {
                                                            var t;
                                                            null!=c[e]&&((t=document.createElement("div")).className="choiceESP", t.style="font-size: 24px; color: darkred; font-weight: bolder;", t.innerText=String(o.state.guest.no[e]), c[e].appendChild(t))
                                                            }
                                                            ), Array.prototype.forEach.call(document.querySelectorAll("[class*=guestButton][role=button]"), e=>e.onclick=()=>Array.prototype.forEach.call(document.querySelectorAll(".choiceESP"), e=>e.remove())))
                                                        }
                                                        )();