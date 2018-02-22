const puppeteer = require('puppeteer');
const $ = require('jquery');
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const inputFile = argv['_'].length > 0 ? argv['_'][0] : null;
if (!inputFile) {
  console.log('No input file.');
}

const outputHTML = argv['outputHTML'];
const outputText = argv['outputText'];

const convertToUnicode = (config) => {
  const bhartiGopikaRegex = /bharati[ ]?gopika/i;
  const gopikaTwo2Regex = /GopikaTwo/i;

  const $ = window.$; //otherwise the transpiler will rename it and won't work
  const body = $('body');
  const BhartiGopikaParser = window.BhartiGopikaParser;
  const GopikaTwo2Parser = window.GopikaTwo2Parser;
  const processElementNodes = (node) => {
    switch (node.nodeName) {
      case 'IMG':
        if (config['img']) {
          let imgHTML = node.outerHTML;
          const height = $(node).css('height');
          const width = $(node).css('width');
          const sizeString = `height="${height}" width="${width}" style="height: ${height};width: ${width}"`;
          imgHTML = imgHTML.replace(
            new RegExp(/(?:class|className)=(?:["']\W+\s*(?:\w+)\()?["']([^'"]+)['"]/, 'g'),
            sizeString
          );

          let imgText = document.createTextNode(imgHTML);
          const parent = $(node).parent()[0];
          parent.insertBefore(imgText, node);
        }
        break;

      default:
        break;
    }
  };

  const processTextNodes = (node) => {
    const verticalAlign = $(node)
      .parent()
      .css('verticalAlign');

    if (verticalAlign === 'super' && config['sup']) {
      node.textContent = '<sup>' + node.textContent + '</sup>';
    }

    if (verticalAlign === 'sub' && config['sub']) {
      node.textContent = '<sub>' + node.textContent + '</sub>';
    }
  };

  const convert = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (config) {
        processElementNodes(node);
      }
      $(node)
        .contents()
        .each((i, elem) => convert(elem));
    } else if (node.nodeType === Node.TEXT_NODE) {
      let fontFamily = $(node)
        .parent()
        .css('fontFamily');

      if (fontFamily.match(bhartiGopikaRegex)) {
        node.textContent = BhartiGopikaParser.convert(node.textContent);
      } else if (fontFamily.match(gopikaTwo2Regex)) {
        node.textContent = GopikaTwo2Parser.convert(node.textContent);
      }

      if (config) {
        processTextNodes(node);
      }
    }
  };

  body.contents().each((i, elem) => convert(elem));
};

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // TODO probable path processing for windows paths
  await page.goto('file://' + inputFile);
  await page.addScriptTag({ path: require.resolve('jquery') });
  await page.addScriptTag({ path: require.resolve('./unicoder/unicode') });
  await page.addScriptTag({ path: require.resolve('./unicoder/unicode-gu') });
  await page.addScriptTag({ path: require.resolve('./unicoder/BhartiGopika') });
  await page.addScriptTag({ path: require.resolve('./unicoder/GopikaTwo2') });

  // page.on('console', (msg) => {
  //   for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
  // });
  // page.evaluate(() => console.log('hello', 5, { foo: 'bar' }));

  if (outputHTML) {
    await page.evaluate(convertToUnicode, true);
    const content = await page.content();
    fs.writeFile(outputHTML, content, function(err) {
      if (err) {
        return console.log(err);
      }
    });
  }

  if (outputText) {
    await page.evaluate(convertToUnicode, { img: true, sup: true, sub: true });
    const text = await page.evaluate(() => $('body')[0].innerText);
    fs.writeFile(outputText, text, function(err) {
      if (err) {
        return console.log(err);
      }
    });
  }

  // console.log("before ==> ", await page.evaluate(() => $("body")[0].innerText));

  // console.log("after ===> ", await page.evaluate(convertToUnicode));
  // await page.evaluate(convertToUnicode);
  // await page.evaluate(convertToUnicode);

  // this prints page contents
  // console.log(await page.content());

  // this return innerText
  // console.log($('body')[0].innerText);
  // console.log(await page.evaluate(() => $('body')[0].innerText));

  // fs.writeFile("html/output1.html", await page.content(), err => {
  //   // throws an error, you could also catch it here
  //   if (err) throw err;

  //   // success case, the file was saved
  //   console.log("Lyric saved!");
  // });
  // const unicodeHTML = await page.evaluate(() => {

  // });

  //   await page.goto('https://google.com');
  // await page.screenshot({ path: "google.png" });

  await browser.close();
})();
