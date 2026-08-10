const { spawn } = require('child_process')

const schema = require('./schema')

const pkgData = require('./package.json')

module.exports = function (app) {
  let child
  let generation = 0
  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  function run_python_plugin(options) {
      let args = ['plugin.py']
      const proc = spawn('ve/bin/python', args, { cwd: __dirname })
      child = proc

      proc.stdout.on('data', data => {
        app.debug(data.toString())
        try {
          data.toString().split(/\r?\n/).forEach(line => {
            // console.log(JSON.stringify(line))
            if (line.length > 0) {
              app.handleMessage(undefined, JSON.parse(line))
            }
          })
        } catch (e) {
          console.error(e.message)
        }
      })

      proc.stderr.on('data', fromChild => {
        console.error(fromChild.toString())
      })

      proc.on('error', err => {
        console.error(err)
      })

      proc.on('close', code => {
        if (code !== 0) {
          console.warn(`Plugin exited ${code}, restarting...`)
        }
        // A close event from an earlier process must not clear the handle to
        // the current one, or the loop below would spawn a second scanner.
        if (child === proc) {
          child = undefined
        }
      })

      proc.stdin.write(JSON.stringify(options))
      proc.stdin.write('\n')
  };
  return {
    start: async (options) => {
      // The server restarts a plugin by calling stop() and start() back to
      // back, and stop() is synchronous, so start() runs before any sleeping
      // loop can wake up. A boolean flag would already be back to true by
      // then; the generation counter makes every earlier loop exit instead.
      const myGeneration = ++generation
      while (myGeneration === generation) {
        if (child === undefined) {
          run_python_plugin(options);
        }
        await sleep(1000);
      }
    },
    stop: () => {
      generation++
      if (child) {
        child.kill()
        child = undefined
      }
    },
    schema,
    id: pkgData.name,
    name: "Victron Instant Data over BLE"
  }
}
