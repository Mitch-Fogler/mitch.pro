(async () =>  {
    var e=document.createElement("iframe");
    document.body.append(e), window.alert=window.alert, window.prompt=window.prompt, window.confirm=window.confirm, e.remove(), window.location.pathname.startsWith("/market")?(async()=> {
        var t=(() =>  {
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
                                            )(), e=Array.prototype.reduce.call(document.querySelectorAll("[class*='packsWrapper'] > div"), (e, t)=>(t.querySelector("[class*='blookContainer'] > img")||(e[t.querySelector("[class*='packImgContainer'] > img").alt]=parseInt(t.querySelector("[class*='packBottom']").textContent)), e),  {
                                                }
                                                ), o=prompt('Which box do you want to open? (ex: "Ice Monster")').split(" ").map(e=>e.charAt(0).toUpperCase()+e.slice(1).toLowerCase()).join(" "), e=e[o];
                                                if(!e)return alert("I couldn't find that box!");
                                                e=Math.floor(t.state.tokens/e);
                                                if(e<=0)return alert("You do not have enough tokens!");
                                                var n=Math.min(e, parseInt(prompt("How many boxes do you want to open?"))||0), a=confirm("Would you like to show blooks as unlocking?"), r= {
                                                    }
                                                    , e=Date.now();
                                                    for(let e=0;
                                                    e<n;
                                                    e++) {
                                                        await t.buyPack(!0, o), r[t.state.unlockedBlook]||=0, r[t.state.unlockedBlook]++, t.startOpening(), clearTimeout(t.openTimeout);
                                                        var c=t.state.purchasedBlookRarity;
                                                        if(t.setState( {
                                                            canOpen:!0, currentPack:"", opening:a, doneOpening:a, openPack:a
                                                            }
                                                            ), clearTimeout(t.canOpenTimeout), "Chroma"==c)break
                                                            }
                                                            await new Promise(e=>setTimeout(e)), alert(`(${Date.now()-e}ms) Results:\n`+Object.entries(r).map(([e, t])=>`    ${e} `+t).join(`\n`))
                                                            }
                                                            )():alert("This can only be ran in the Market page.")
                                                        }
                                                        )();