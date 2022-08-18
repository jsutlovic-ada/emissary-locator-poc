/*
 * Copyright 2017 Datawire. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Example auth service for Ambassador[1] using ExtAuth[2].
 * See the Ambassador documentation[3] for more information.
 * [1]: https://github.com/datawire/ambassador
 * [2]: https://github.com/datawire/ambassador-envoy
 * [3]: http://www.getambassador.io/
*/

const express = require('express')
const app = express()
const addRequestId = require('express-request-id')()

// Always have a request ID.
app.use(addRequestId)

// Add verbose logging of requests (see below)
app.use(logRequests)

// Forward to a cell based on hostname
app.all('/extauth/*', function(req, res) {
  const host = req.headers['host']

  if (!host || host.startsWith("none")) {
    console.log('  No host header')
    res.status(404).send("Host not found")
    return
  }

  console.log(`  Test request headers for ${host}`)
  if (host.startsWith("foo")) {
    console.log(`  Got "foo" host, forwarding to B cell`)
    res.set('x-cell-choice', 'B')
    res.send(`OK (cell B)`)
    return
  } else if (host.startsWith("bar")) {
    console.log(`  Got "bar" host, forwarding to A cell`)
    res.set('x-cell-choice', 'A')
    res.send(`OK (cell A)`)
    return
  }

  console.log(`  No cell match, forwarding to default`)
  res.send(`OK (default)`)
})

// Everything else is okay without auth
app.all('*', function (req, res) {
  console.log(`Allowing request to ${req.path}`)
  res.send(`OK (not ${authPath})`)
})

app.listen(3000, function () {
  console.log('Subrequest auth server sample listening on port 3000')
})

// Middleware to log requests, including basic auth header info
function logRequests (req, res, next) {
  console.log('\nNew request')
  console.log(`  Path: ${req.path}`)
  console.log(`  Incoming headers >>>`)
  Object.entries(req.headers).forEach(
    ([key, value]) => console.log(`    ${key}: ${value}`)
  )
  return next()
}
