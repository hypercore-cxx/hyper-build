const fs = require('fs')
const path = require('path')
const { spawnSync, execSync } = require('child_process')
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

    const r = spawnSync('git', ['ls-remote', '--get-url'], { cwd: process.cwd() })

    if (r.status > 0) {
      console.error(`${r.stderr.toString()}`)
      process.exit(r.status)
    }

    console.log(r)

    pkg = {
      name: '',
      description: '',
      dependencies: {},
      main: 'index.cxx',
      flags: ['-std=c++2a'],
      repository: {
        type: 'git',
        url: r.stdout.toString().trim()
      },
      scripts: {
        'test': 'c++ test/index.cxx -o test/index && ./test/index',
        'install': ''
      }
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
    build init                  initialze a new project
`)
}

function add (argv, pkg) {
  const shorthandRE = /^[^/ ]+\/[^/ ]+$/
  const hash = argv[1] || '*'
  let remote = argv[0]

  console.log(remote)
  if (shorthandRE.test(remote)) {
    remote = `git@github.com:${remote}.git`
  }

  pkg.dependencies[remote] = hash
  writePackage(pkg)
}

async function build (argv, pkg) {
  const sources = []
  const headers = []

  //
  // - visit each dep
  // - join the path of the package and the main field.
  // - if is a .hxx push to headers[]
  // - otherwise push to sources[]
  //
  const collect = pwd => {
    const files = fs.readdirSync(pwd)

    for (const file of files) {
      if (file[0] === '.') continue

      let stat = null
      const p = path.join(pwd, file)

      try {
        stat = fs.statSync(p)
      } catch (err) {}

      if (stat.isDirectory()) {
        collect(p)
        continue
      }

      if (file !== 'package.json') continue

      const dpkg = require(p)

      if (!dpkg.main) {
        console.error('Package has no main!')
        process.exit(1)
      }

      const v = path.join(pwd, path.dirname(dpkg.main))

      if (path.extname(dpkg.main).includes('.h')) {
        headers.push(v)
      } else if (path.extname(dpkg.main).includes('.c')) {
        sources.push(path.join(pwd, dpkg.main))
      }
    }
  }

  collect(process.cwd())

  const cmd = [
    `c++`,
    pkg.flags.join(' '),
    argv.join(' '),
    headers.map(h => `-I${h}`),
    sources.join(' ')
  ].join(' ')

  if (process.env.DEBUG) {
    console.log(cmd)
  }

  const r = execSync(cmd, argv)

  if (r.status > 0) {
    console.error(`${r.stderr.toString()}`)
    process.exit(r.status)
  } else {
    console.log('OK')
  }
}

//
// may be called recursively, starting at cwd.
// clones all dependencies into their `deps` dir.
// runs their install scripts, depth first.
//
async function install (cwd, argv, pkg) {
  if (!pkg.dependencies) {
    console.log(`${pkg.name} has no dependencies`)
    return
  }

  const deps = Object.entries(pkg.dependencies)

  for (let [remote, hash] of deps) {
    if (hash === '*') {
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
      console.log(`${dpkg.name} running install script`)
      console.log('>', dpkg.scripts.install)

      const r = spawnSync(dpkg.scripts.install, opts)

      if (r.status > 0) {
        console.error(`${r.stderr.toString()}`)
        process.exit(r.status)
      }
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
    case 'init':
      return init(argv, pkg)
    default:
      return build([cmd, ...argv], pkg)
  }
}

main()
