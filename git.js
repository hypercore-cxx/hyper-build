const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = async (cwd, remote, hash) => {
  let exists = true
  let args = null
  let shorthand = ''
  let action = ''

  try {
    shorthand = remote.split(':')[1]
    shorthand = shorthand.replace('/', path.sep)
  } catch (err) {
    console.error(`Malformed remote! (${remote})`)
    process.exit(1)
  }

  const opts = {}
  const target = path.join(cwd, 'deps', shorthand)

  try {
    fs.statSync(target)
  } catch (err) {
    exists = false
  }

  if (exists) {
    action = 'Updating'
    args = [
      `pull`,
      `--rebase`,
      `origin`,
      'master'
    ]

    opts.cwd = path.join(target)
  } else {
    action = 'Fetching'
    args = [
      `clone`,
      remote,
      target
    ]
  }

  console.log(`${action} ${shorthand}...`)
  const r = spawnSync('git', args, opts)

  if (r.status > 0) {
    console.log(`${r.stderr.toString()}`)
    process.exit(r.status)
  }

  opts.cwd = path.join(target)

  //
  // If the user specified a hash, check it out.
  //
  if (hash) {
    console.log(`Checking out ${hash}`)
    const r = spawnSync('git', ['checkout', hash], opts)

    if (r.status > 0) {
      console.log(`${r.stderr.toString()}`)
      process.exit(r.status)
    }
  } else {
    //
    // Otherwise get the latest hash to update the package.json
    //
    const r = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], opts)

    if (r.status > 0) {
      console.log(`${r.stderr.toString()}`)
      process.exit(r.status)
    }

    console.log(`Updated dependency to ${r.stdout}`)
    hash = r.stdout.toString().trim().slice(0, 8)
  }

  return {
    hash,
    target
  }
}
