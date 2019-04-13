# SYNOPSIS

Build is an opinionated `c++` build-tool. It uses `git` and `node.js`. It's made
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
Use the `init` command to automatically create a `package.json` file.

```bash
build init
```

### ADD DEPENDENCY
Use the `add` command to add a dependency.

```bash
build add foo/bar
```

Adding a dependency **with** a hash will lock the dependency and
install that exact commit at install-time. Without a hash, the dependency
will get assigned the latest commit hash of the remote at install-time.

```bash
build add foo/bar ceda12f
```

### INSTALL DEPENDENCIES
Use the `i` command to recursively install dependencies.

```bash
build i
```

### TESTING
Use the `test` command to run the test script from the `package.json`. This will
automatically discover and use all of dependecy headers and source files. This
will check for and try to run `pretest` and `posttest` scripts if possible.

```bash
build test
```

### BUILDING
To build your project, don't specify any commands just type `build`. Use the
`DEBUG=true` environment variable if you want to print what the compiler is
being asked to do. The build tool will discover all dependecy headers and source
files.

```bash
build
```

When no command is specified, all flags are passed to the compiler. For example
following flags are sent to the compiler.

```bash
build -g -O0
```

# PACKAGE.JSON

### FIELDS

#### name
Name is required. But unlike npm the name and version do not create a unique
identity in the world for your package. In fact, version is not used at all.

#### description
Put a description in it. It’s a string. This helps you remember what the package
does.

#### files
A list of files to include. Nothing is included by default. Does not currently
support globs.

#### repository
A string that specifies the place where the code lives. This is helpful for
people who want to contribute.

#### scripts
The “scripts” property is a dictionary containing script commands that are run 
at various times in the lifecycle of your package. The key is the lifecycle
event, and the value is the command to run at that point. The following scripts
are supported.

- `install` Run AFTER the package is installed.
- `pretest` Run BEFORE the test command.
- `test` Run by the test command.
- `posttest` Run AFTER the test command.

The `test` script is special because it will automatically discover headers
and compilation units needed by your dependencies.

You can also create your own arbitrary scripts and run them with the command
`build run <script-name>`.

### EXAMPLE

```json
{
  "name": "hypercore",
  "description": "Hypercore is a secure, distributed append-only log.",
  "repository": "git@github.com:datcxx/cxx-hypercore.git",
  "dependencies": {
    "git@github.com:datcxx/cxx-flat-tree": "c051eac4"
  },
  "scripts": {
    "test": "c++ -std=c++2a test/index.cxx lib/hypercore.so -o test/index && ./test/index",
    "greeting": "echo Hello, World"
  },
  "flags": [
    "-shared",
    "-o ./lib/hypercore.so",
    "-std=c++2a",
    "-ferror-limit=2"
  ],
  "files": [
    "index.hxx",
    "index.cxx"
  ]
}
```

# TODO
Nice to have - as of now there is no caching strategy.

