const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { version } = require('./package.json')

const cloneOrPull = require('./git')

const pkgLocation = path.join(process.cwd(), '/package.json')

function getPackage (cmd) {
  let pkg = null

  try {
    pkg = require(pkgLocation)
  } catch (err) {
    const ENOTFOUND = err.message.includes('Cannot find')

    if (!ENOTFOUND) {
      console.error(err.message)
      process.exit(1)
    }

    if (!['h', 'help', 'init'].includes(cmd)) {
      console.error('No package.json found. Try "build init"?')
      process.exit(1)
    }

    let remote = ''

    try {
      const opts = { stdio: 'pipe', cwd: process.cwd() }
      remote = execSync('git remote get-url origin', opts)
    } catch (err) {
      console.log(String(err.stderr))
      process.exit(1)
    }

    pkg = {
      name: '',
      description: '',
      repository: {
        type: 'git',
        url: remote.toString().trim()
      },
      dependencies: {},
      license: 'MIT',
      scripts: {
        'test': 'c++ test/index.cxx -o test/index && ./test/index',
        'install': ''
      },
      flags: ['-std=c++2a'],
      files: ['index.cxx']
    }
  }

  return pkg
}

function writePackage (pkg) {
  try {
    fs.writeFileSync(pkgLocation, JSON.stringify(pkg, 2, 2))
  } catch (err) {
    console.error(`Unable to write to package.json (${err.message})`)
    process.exit(1)
  }
}

function help (argv, pkg) {
  console.log(`
    build v${version}

    build [...args]             build the project
    build add <remote> <hash>   add git dependency at hash
    build h|help                print this help screen
    build i|install             recursively install all deps
    build u|upgrade             recursively upgrade all deps
    build init                  initialze a new project
    build run <name>            run a sepecific script
    build test                  run the test script
`)
}

function add (argv, pkg) {
  const shorthandRE = /^[^/ ]+\/[^/ ]+$/
  const hash = argv[1] || '*'
  let remote = argv[0]

  if (shorthandRE.test(remote)) {
    remote = `git@github.com:${remote}`
  }

  pkg.dependencies[remote] = hash
  writePackage(pkg)
}

function collect () {
  const sources = []
  const headers = []

  //
  // - visit each dep
  // - join the path of the package and the sources field.
  // - if is a .hxx push to headers[]
  // - otherwise push to sources[]
  //
  const walk = pwd => {
    const files = fs.readdirSync(pwd)

    for (const file of files) {
      if (file[0] === '.') continue

      let stat = null
      const p = path.join(pwd, file)

      try {
        stat = fs.statSync(p)
      } catch (err) {}

      if (stat.isDirectory()) {
        walk(p)
        continue
      }

      if (file !== 'package.json') continue

      const dpkg = require(p)

      if (!dpkg.files) {
        console.error('Package has no files field!')
        process.exit(1)
      }

      dpkg.files.forEach(file => {
        const v = path.join(pwd, path.dirname(file))

        if (path.extname(file).includes('.h')) {
          headers.push(v)
        } else if (path.extname(file).includes('.c')) {
          sources.push(path.join(pwd, file))
        }
      })
    }
  }

  walk(process.cwd())

  return {
    sources,
    headers
  }
}

function build (argv, pkg) {
  const { headers, sources } = collect()

  const NL = ' \\\n'

  const cmd = [
    `c++ ${NL}`,
    pkg.flags ? pkg.flags.join(NL) : '',
    argv.join(NL),
    sources.join(NL)
  ].join(' \\\n')

  const env = {
    CPLUS_INCLUDE_PATH: headers.join(path.delimiter)
  }

  return run(cmd, { env })
}

function test (script, argv) {
  if (Array.isArray(script)) {
    script = script.join(' ')
  }

  const { headers, sources } = collect()

  const NL = ' \\\n'

  script = script.replace('++', `++ ${sources.join(' ')} `)

  const cmd = [
    script,
    argv.join(NL)
  ].join(' \\\n')

  const env = {
    CPLUS_INCLUDE_PATH: headers.join(path.delimiter)
  }

  if (process.env.DEBUG) {
    console.log(env)
  }

  return run(cmd, { env })
}

function run (script, opts = {}) {
  if (process.env.DEBUG) {
    console.log(script)
  }

  if (Array.isArray(script)) script = script.join(' ')

  opts.stdio = 'pipe'

  try {
    const output = execSync(script, opts)

    return {
      status: 0,
      output: output.toString().trim()
    }
  } catch (err) {
    return {
      status: err.status,
      output: err.output
        .filter(Boolean)
        .map(buf => String(buf))
        .join('\n')
        .trim()
    }
  }
}

//
// may be called recursively, starting at cwd.
// clones all dependencies into their `deps` dir.
// runs their install scripts, depth first.
//
async function install (cwd, argv, pkg, upgrade) {
  if (!pkg.dependencies) {
    console.log(`${pkg.name} has no dependencies`)
    return
  }

  const deps = Object.entries(pkg.dependencies)

  for (let [remote, hash] of deps) {
    if (hash === '*' || upgrade) {
      //
      // if the hash is '*', dont pass it,
      // let git tell us what hash to use.
      //
      hash = undefined
    }

    const info = await cloneOrPull(cwd, remote, hash)
    pkg.dependencies[remote] = info.hash

    //
    // get the package.json for this dep
    //
    const dpkg = require(path.join(info.target, 'package.json'))

    //
    // recurse!
    //
    await install(info.target, argv, dpkg)

    //
    // If there are install script, run them (depth first).
    //
    if (!dpkg.scripts) continue

    const opts = { cwd: info.target }

    if (dpkg.scripts.install) {
      console.log(`${dpkg.name} -> ${dpkg.scripts.install}`)

      const r = run(dpkg.scripts.install, opts)
      console.log(r.output)
    }
  }

  writePackage(pkg)
}

function init (argv, pkg) {
  try {
    fs.statSync(pkgLocation)
  } catch (err) {
    writePackage(pkg)
  }

  const depsDir = path.join(process.cwd(), 'deps')

  try {
    fs.statSync(depsDir)
  } catch (err) {
    fs.mkdirSync(depsDir)
  }
}

async function main () {
  const argv = process.argv.slice(2)
  const cmd = argv.shift()
  const pkg = getPackage(cmd)

  switch (cmd) {
    case 'add':
      return add(argv, pkg)
    case 'h':
    case 'help':
      return help(argv, pkg)
    case 'i':
    case 'install':
      return install(process.cwd(), argv, pkg)
    case 'u':
    case 'upgrade':
      return install(process.cwd(), argv, pkg, true)

    case 'init':
      return init(argv, pkg)

    case 'test': {
      if (!pkg.scripts) {
        console.log('Package has no .scripts[] property.')
        process.exit(1)
      }

      if (pkg.scripts.pretest) {
        const r = run(pkg.scripts.pretest, argv)
        console.log(r.output)
      }

      const r = test(pkg.scripts.test, argv)
      console.log(r.output)

      if (pkg.scripts.posttest) {
        const r = run(pkg.scripts.posttest, argv)
        console.log(r.output)
      }

      break
    }

    case 'run': {
      const name = argv.shift()
      const script = pkg.scripts[name]

      const r = run(script, {})
      console.log(r.output)

      break
    }

    default: {
      const r = build([cmd, ...argv], pkg)

      if (r === 0) {
        console.log('OK build')
      } else {
        console.log(r.output)
      }
    }
  }
}

main()
