#!/usr/bin/env python
import os, shutil, re, simplejson as json, zipfile

# for writing directory to a new zip file
def zipdir(path, zip_handle):
    for root, dirs, files in os.walk(path):
        for file in files:
            filepath = os.path.join(root, file);
            zip_handle.write(filepath, filepath[len(path)+len(os.sep):])

# copies manifest from platform specific manifest and packages for distribution
def buildForPlatform(platform='chrome', extension='zip', version=None):
    print 'building for %s...' % platform

    # update manifest
    with open(os.path.join(os.path.curdir, 'dev', 'manifest.json'), 'r') as f:
        manifest = json.load(f)
        if version is None: version = manifest['version']

    # update version from build targets json file
    with open(os.path.join(os.path.curdir, 'dev', 'manifest.json'), 'r+') as f:
        manifest_text = f.read()
        manifest_text = re.sub('"version": "[0-9.]+"', '"version": "'+version+'"', manifest_text);
        f.seek(0)
        f.write(manifest_text)

    # build chrome extension zip file
    zip_filename = os.path.join(os.path.curdir, 'builds',
    '.'.join([manifest['name'].replace(" ", ""), platform, version, extension]))
    if (os.path.isfile(zip_filename)): os.remove(zip_filename)
    zipf = zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED)
    zipdir(os.path.join(os.path.curdir, 'dev'), zipf)
    zipf.close()

# load build targets from file and build as specified
with open(os.path.join(os.path.curdir, 'build_targets.json'), 'r') as f:
    build_targets = json.load(f)
    for target in build_targets: buildForPlatform(**target)

print 'all done!'
