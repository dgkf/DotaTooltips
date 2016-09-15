import os, shutil, re, simplejson as json, zipfile

# for writing directory to a new zip file
def zipdir(path, zip_handle):
    for root, dirs, files in os.walk(path):
        for file in files:
            filepath = os.path.join(root, file);
            zip_handle.write(filepath, filepath[len(path)+len(os.sep):])

# copies manifest from platform specific manifest and packages for distribution
def buildForPlatform(platform='chrome', extension='zip'):
    print 'building for %s...' % platform
    # copy chrome manifest to extension root
    shutil.copyfile(os.path.join(os.path.curdir, 'dev', 'manifests', 'manifest.'+platform+'.json'),
                    os.path.join(os.path.curdir, 'dev', 'manifest.json'));

    # update manifest
    with open(os.path.join(os.path.curdir, 'dev', 'manifests', 'manifest.'+platform+'.json'), 'r') as f:
        manifest = json.load(f)

    # increment manifest version
    # manifest_ver = map(int, manifest['version'].split('.'))
    # manifest_ver[-1] += 1;
    # manifest_ver = '.'.join(map(str,manifest_ver))
    # manifest['version'] = manifest_ver;

    # update version in extension root manifest_ver
    with open(os.path.join(os.path.curdir, 'dev', 'manifest.json'), 'r+') as f:
        manifest_text = f.read()
        manifest_text = re.sub('"version": "[0-9.]+"', '"version": "'+manifest['version']+'"', manifest_text);
        f.seek(0)
        f.write(manifest_text)

    # build chrome extension zip file
    zipf = zipfile.ZipFile(os.path.join(os.path.curdir, 'builds',
    '.'.join([manifest['name'].replace(" ", ""), platform, manifest['version'], extension])), 'w', zipfile.ZIP_DEFLATED)
    zipdir(os.path.join(os.path.curdir, 'dev'), zipf)
    zipf.close()

# load build targets from file and build as specified
with open(os.path.join(os.path.curdir, 'build_targets.json'), 'r') as f:
    build_targets = json.load(f)
    for target in build_targets: buildForPlatform(**target)

print 'all done!'
