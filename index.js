let shell = require('shelljs');
let args = require('args');

args.options([
  {
    name: ['p', 'package'],
    description: 'Name of the package you want to unpin'
  },
  {
    name: ['t', 'type'],
    description: 'Type of SSL unpinning script you want to use'
  },
]);

let flags = args.parse(process.argv);

if (flags.type != '1' && flags.type != '2') {
  console.log("Can't find specified payload");
  process.exit();
}

if (!flags.package) {
  console.log('No package specified. Run node index.js -h to see available options');
  process.exit();
}

let server = shell.exec('adb shell ps | grep frida-server', { silent: true }).stdout;

if (!server.stdout) {
  let serverExists = shell.exec('adb shell test -e /data/local/tmp/frida-server && echo true || echo false', { silent: true });

  if (serverExists.stdout.includes('false')) {
    console.log('Server not exist, pushing frida-server to device');

    let architectureExec = shell.exec('adb shell getprop | grep abi', { silent: true });

    let architecture = '';

    let architectures = ['arm64', 'x86_64', 'x86', 'arm'];

    for (a of architectures) {
      if (architectureExec.stdout.includes(a)) {
        architecture = a;
        break;
      }
    }

    shell.exec(`adb push frida-server-12.6.5-android-${a} /data/local/tmp/frida-server && adb shell "chmod 755 /data/local/tmp/frida-server"`, { silent: true });
  }

  if (flags.type == '1') {
    let certExists = shell.exec('adb shell test -e /data/local/tmp/cert-der.crt && echo true || echo false', { silent: true });  

    if (certExists.stdout.includes('false')) {
      console.log('Cert not exist, pushing cert to device');

      shell.exec(`adb push ${__dirname}/cert.cer /data/local/tmp/cert-der.crt`, { silent: true });
    }
  }

  console.log('Server not started, starting server');

  let startServerExec = shell.exec('adb shell "/data/local/tmp/frida-server &"', { silent: true });

  if (startServerExec.code !== 0) {
    throw startServerExec.stderr;
  }

  console.log('Server started successfully');

  let packageExec = shell.exec(`adb shell pm list packages -f | grep ${flags.package}`, { silent: true });

  let foundPackages = packageExec.stdout;

  if (!foundPackages || !foundPackages.length) {
    throw new Error(`Found no package with name ${flags.package}`);
  }

  let filteredPackages = foundPackages.split('\n').filter(p => p);

  if (filteredPackages.length > 1) {
    console.log(`Found ${filteredPackages.length} packages, please re-run with full package name`);
    console.log(foundPackages);
    process.exit();
  }

  let packageName = foundPackages.replace(/\n/g, '').split('=').reverse()[0].trim();

  console.log(packageName);

  console.log(`Bypass SSL pinning ${packageName} using payload ${flags.type}`);

  shell.exec(`frida -U -f ${packageName} -l payload_${flags.type}.js --no-pause`);
}
