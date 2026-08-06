(async () =>  {
    const a=["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
    function r(o) {
        var r=RegExp("[^a-zA-Z 0-9]+", "g");
        let l=o.toString();
        if(1e3<=o) {
            var e=["", "K", "M", "B", "T"], n=Math.floor(Math.floor((Math.log(o)/Math.log(10)).toPrecision(14))/3);
            if(n<e.length) {
                let t="";
                for(let e=3;
                1<=e;
                e--)if((t=parseFloat((0!=n?o/Math.pow(1e3, n):o).toPrecision(e)).toString()).replace(r, "").length<=3)break;
                Number(t)% 1!=0&&(t=Number(t).toFixed(1)), l=t+e[n]
                }
                else {
                    let e=o, t=0;
                    for(;
                    100<=e;
                    )e=Math.floor(e/10), t+=1;
                    l=e/10+" × 10"+function(e) {
                        let t="";
                        for(;
                        0<e;
                        )t=a[e% 10]+t, e=Math.floor(e/10);
                        return t
                        }
                        (t+1)
                        }
                        }
                        return l
                        }
                        let l=(() =>  {
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
                                                            )();
                                                            const e=document.querySelector('[class*="rockButton"]').parentElement.children;
                                                            Array.prototype.every.call(e, e=>e.querySelector("div"))||l.setState( {
                                                                choices:function(r, e) {
                                                                    for(var l=[];
                                                                    l.length<e;
                                                                    ) {
                                                                        var n=Math.random();
                                                                        let t=0, o;
                                                                        for(let e=0;
                                                                        e<r.length;
                                                                        e++)if((t+=r[e].rate)>=n) {
                                                                            o=r[e];
                                                                            break
                                                                            }
                                                                            o&&!l.includes(o)&&l.push(o)
                                                                            }
                                                                            return l
                                                                            }
                                                                            ([ {
                                                                                type:"fossil", val:10, rate:.1, blook:"Amber"
                                                                                }
                                                                                ,  {
                                                                                    type:"fossil", val:25, rate:.1, blook:"Dino Egg"
                                                                                    }
                                                                                    ,  {
                                                                                        type:"fossil", val:50, rate:.175, blook:"Dino Fossil"
                                                                                        }
                                                                                        ,  {
                                                                                            type:"fossil", val:75, rate:.175, blook:"Stegosaurus"
                                                                                            }
                                                                                            ,  {
                                                                                                type:"fossil", val:100, rate:.15, blook:"Velociraptor"
                                                                                                }
                                                                                                ,  {
                                                                                                    type:"fossil", val:125, rate:.125, blook:"Brontosaurus"
                                                                                                    }
                                                                                                    ,  {
                                                                                                        type:"fossil", val:250, rate:.075, blook:"Triceratops"
                                                                                                        }
                                                                                                        ,  {
                                                                                                            type:"fossil", val:500, rate:.025, blook:"Tyrannosaurus Rex"
                                                                                                            }
                                                                                                            ,  {
                                                                                                                type:"mult", val:1.5, rate:.05
                                                                                                                }
                                                                                                                ,  {
                                                                                                                    type:"mult", val:2, rate:.025
                                                                                                                    }
                                                                                                                    ], 3)
                                                                                                                    }
                                                                                                                    , ()=> {
                                                                                                                        Array.prototype.forEach.call(e, (e, t)=> {
                                                                                                                            var t=l.state.choices[t], o=(e.querySelector("div")&&e.querySelector("div").remove(), document.createElement("div"));
                                                                                                                            o.style.color="white", o.style.fontFamily="Macondo", o.style.fontSize="1em", o.style.display="flex", o.style.justifyContent="center", o.style.transform="translateY(25px)", o.innerText="fossil"===t.type?`+${99999999<Math.round(t.val*l.state.fossilMult)?r(Math.round(t.val*l.state.fossilMult)):Math.round(t.val*l.state.fossilMult)} Fossils`:`x${t.val} Fossils Per Excavation`, e.append(o)
                                                                                                                            }
                                                                                                                            )
                                                                                                                            }
                                                                                                                            )
                                                                                                                        }
                                                                                                                        )();