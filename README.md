# SYNOPSIS

Build is an opinionated build-tool. It uses `git` and `node.js`. It's made
for use with the `datcxx` project.

# MOTIVATION

C++ build tools and package managers are highly ambitious and try to solve
a larger set of problems than needed for this project. Let's make something
that...

- Uses a subset of `package.json`.
- No semver, or package-locks, use git commit hashes.
- No login, no users, no analytics, no fancy features.

# INSTALL

```bash
npm install -g datcxx/build
```

# USAGE
All projects must have a package.json.

```bash
build -h
```

### INIT
Automatically create a `package.json` file.

### ADD DEPENDENCY
Adding a dependency without a hash will get assign it the
latest commit hash of the remote at install-time.

```bash
build add foo/bar
```

Adding a dependency with a hash will lock the dependency and
install that exact commit at install-time.

```bash
build add foo/bar ceda12f
```

### INSTALL DEPENDENCIES
To recursively install dependencies.

```bash
build i
```

### BUILD YOUR PROJECT
To build your project. Use `DEBUG=true` to show compiler commands.

```bash
build
```

# TODO
Nice to have - as of now there is no caching strategy.

