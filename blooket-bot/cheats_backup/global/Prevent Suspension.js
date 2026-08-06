(async () =>  {
    if("function call() { [native code] }"==window.fetch.call.toString()) {
        const t=window.fetch.call;
        window.fetch.call=function() {
            if(!arguments[1].includes("s.blooket.com/rc"))return t.apply(this, arguments)
            }
            }
        }
        )();