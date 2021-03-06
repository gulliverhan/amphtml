/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const app = module.exports = require('express').Router();

/*eslint "max-len": 0*/

app.use('/compose-doc', function(req, res) {
  res.setHeader('X-XSS-Protection', '0');
  const mode = process.env.SERVE_MODE == 'compiled' ? '' : 'max.';
  const frameHtml = process.env.SERVE_MODE == 'compiled'
    ? 'dist.3p/current-min/frame.html'
    : 'dist.3p/current/frame.max.html';
  const extensions = req.query.extensions;
  let extensionScripts = '';
  if (!!extensions) {
    extensionScripts = extensions.split(',').map(function(extension) {
      return '<script async custom-element="'
              + extension + '" src=/dist/v0/'
              + extension + '-0.1.' + mode + 'js></script>';
    }).join('\n');
  }

  const experiments = req.query.experiments;
  let metaTag = '';
  let experimentString = '';
  if (experiments) {
    metaTag = '<meta name="amp-experiments-opt-in" content="' +
      experiments + '">';
    experimentString = '"' + experiments.split(',').join('","') + '"';
  }

  res.send(`
<!doctype html>
<html ⚡>
<head>
  <meta charset="utf-8">
  <link rel="canonical" href="http://nonblocking.io/" >
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
  ${metaTag}
  <script>
    window.AMP_CONFIG = window.AMP_CONFIG || {};
    window.AMP_CONFIG['allow-doc-opt-in'] =
    (window.AMP_CONFIG['allow-doc-opt-in'] || []).concat([${experimentString}]);
  </script>
  <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
  <script async src="/dist/${process.env.SERVE_MODE == 'compiled' ? 'v0' : 'amp'}.js"></script>
  <meta name="amp-3p-iframe-src" content="http://localhost:9876/${frameHtml}">
  ${extensionScripts}
  <style amp-custom>${req.query.css}</style>
</head>
<body>
${req.query.body}
</body>
</html>
`);
});

/**
 * A server side temporary request storage which is useful for testing
 * browser sent HTTP requests.
 */
const bank = {};

/**
 * Deposit a request. An ID has to be specified. Will override previous request
 * if the same ID already exists.
 */
app.use('/request-bank/deposit/:id', (req, res) => {
  if (typeof bank[req.params.id] === 'function') {
    bank[req.params.id](req);
  } else {
    bank[req.params.id] = req;
  }
  res.end();
});

/**
 * Withdraw a request. If the request of the given ID is already in the bank,
 * return it immediately. Otherwise wait until it gets deposited
 * The same request cannot be withdrawn twice at the same time.
 */
app.use('/request-bank/withdraw/:id', (req, res) => {
  const result = bank[req.params.id];
  if (typeof result === 'function') {
    return res.status(500).send('another client is withdrawing this ID');
  }
  const callback = function(result) {
    res.json({
      headers: result.headers,
    });
    delete bank[req.params.id];
  };
  if (result) {
    callback(result);
  } else {
    bank[req.params.id] = callback;
  }
});

