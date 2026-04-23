import puppeteer from "puppeteer";
import TurndownService from "turndown";
let globalBrowser = null;
const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
});
// Remover elementos de UI que sujam a leitura
turndownService.remove(["script", "style", "nav", "header", "footer", "iframe", "svg", "noscript", "canvas", "form", "aside"]);
export async function getBrowser() {
    if (!globalBrowser) {
        globalBrowser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
    }
    return globalBrowser;
}
export async function lerPaginaWebComoMarkdown(url) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    // Bloqueando resources inúteis
    await page.setRequestInterception(true);
    page.on("request", (req) => {
        const type = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(type)) {
            req.abort();
        }
        else {
            req.continue();
        }
    });
    try {
        const finalUrl = url.startsWith("http") ? url : `https://${url}`;
        await page.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        const html = await page.evaluate(() => {
            const selectorsToRemove = [
                "script",
                "style",
                "nav",
                "header",
                "footer",
                "iframe",
                "svg",
                "noscript",
                "canvas",
                "form",
                "aside",
                ".sidebar",
                ".menu",
                ".advertisement",
                ".ads",
            ];
            const elementsToRemove = document.querySelectorAll(selectorsToRemove.join(", "));
            elementsToRemove.forEach((el) => el.remove());
            const mainEl = document.querySelector("main") || document.querySelector("article");
            return mainEl ? mainEl.innerHTML : document.body.innerHTML;
        });
        const markdown = turndownService.turndown(html);
        return markdown || "A página não possui texto legível útil ou está bloqueando bots.";
    }
    catch (err) {
        throw new Error(`Erro ao acessar página: ${err instanceof Error ? err.message : String(err)}`);
    }
    finally {
        await page.close();
    }
}
export async function pesquisarDuckDuckGoNodeless(query, maxResults = 8) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
        const type = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(type)) {
            req.abort();
        }
        else {
            req.continue();
        }
    });
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        const results = await page.evaluate((max) => {
            const items = Array.from(document.querySelectorAll(".result"));
            return items.slice(0, max).map((item) => {
                const titleEl = item.querySelector(".result__title a") || item.querySelector(".result__a");
                const snippetEl = item.querySelector(".result__snippet");
                const urlEl = item.querySelector(".result__url");
                return {
                    title: titleEl?.textContent?.trim() || "",
                    url: titleEl?.href || urlEl?.href || "",
                    snippet: snippetEl?.textContent?.trim() || "",
                };
            });
        }, maxResults);
        if (results.length === 0) {
            return "Nenhum resultado encontrado para a pesquisa.";
        }
        let report = `Resultados da busca para "${query}":\n\n`;
        results.forEach((r, i) => {
            const finalUrl = r.url.startsWith("//") ? `https:${r.url}` : r.url;
            report += `${i + 1}. **${r.title}**\nURL: ${finalUrl}\nResumo: ${r.snippet}\n\n`;
        });
        return report;
    }
    catch (err) {
        throw new Error(`Erro na pesquisa: ${err instanceof Error ? err.message : String(err)}`);
    }
    finally {
        await page.close();
    }
}
