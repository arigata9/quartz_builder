const chokidar = require('chokidar');
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

// Define the Vault directory to watch
const VAULT_DIR = process.env.VAULT_DIR || '/vault';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/output';
const TIMER = process.env.TIMER || 20;
const FOLDER = process.env.FOLDER || '/public';

// Function to execute a shell command
const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // reject(`Error: ${error.message}`); //Because some libraries are deprecated it otherwise breaks as they throw an error
        resolve(`stderr: ${stderr}`);
        return;
      }
      if (stderr) {
        // reject(`stderr: ${stderr}`); //Because some libraries are deprecated it otherwise breaks as they an throw error
        resolve(`stderr: ${stderr}`);
        return;
      }
      resolve(stdout);
    });
  });
};

// Run the Quartz build process
const runBuild = async () => {
  try {
    console.log(`Copying from ${VAULT_DIR}${FOLDER}/* to quartz.`)
    await runCommand(`rm -rf /quartz/content/*`); // Remove previous data
    await runCommand(`cp -r ${VAULT_DIR}${FOLDER}/* /quartz/content/`);
    await runCommand('cd /quartz && npm run quartz build');

    await runCommand(`rm -rf ${OUTPUT_DIR}/*`);  // Remove all files in the output directory
    await runCommand(`cp -r /quartz/public/* ${OUTPUT_DIR}`)
    console.log(`Quartz build completed successfully to ${OUTPUT_DIR}!`);
  } catch (error) {
    console.error('Build failed:', error);
  }
};


let directory = `${VAULT_DIR}${FOLDER}`
console.log(`The folder that will be monitored and published is: ${directory}`)

console.log(`Used to be: ${VAULT_DIR}`)
const watcher = chokidar.watch(directory, {
  ignored: /^\./, // Ignore dotfiles
  persistent: true,
  usePolling: true, // Poll instead of using native fs events (useful for Docker containers)
  interval: TIMER/10 * 60000, // Time in ms between each polling at 10 times the rate of update
  atomic: true, // Makes sure files are fully written before triggering an event
  recursive: true,
  ignoreInitial: true, // Ignore initial files as we are already doing a build on start
});

let timeout;

// When a file is changed, added, or removed, start the timer
watcher.on('change', (path) => {
  console.log(`${path} has been changed. Waiting for ${TIMER}  minutes of inactivity...`);

  clearTimeout(timeout);
  timeout = setTimeout(runBuild, TIMER * 60 * 1000); // 5 minutes of inactivity
});

watcher.on('add', (path) => {
  console.log(`${path} has been added. Waiting for ${TIMER} minutes of inactivity...`);

  clearTimeout(timeout);
  timeout = setTimeout(runBuild, TIMER * 60 * 1000); // 5 minutes of inactivity
});

watcher.on('unlink', (path) => {
  console.log(`${path} has been removed. Waiting for ${TIMER} minutes of inactivity...`);

  clearTimeout(timeout);
  timeout = setTimeout(runBuild, TIMER * 60 * 1000); // 5 minutes of inactivity
});


// Start the watcher
watcher.on('ready', () => {
  runBuild();
  console.log(`Watching for changes in ${VAULT_DIR}, specifically in folder ${FOLDER} of vault...`);
});


//Express server to serve the files
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.static(OUTPUT_DIR, { extensions: ["html", "htm"]}));
// Serve 404 file
app.get('*', function(req, res){
  res.status(404).sendFile(path.join(OUTPUT_DIR, "404.html"));
});

app.get('*.php', function(req, res){
  // Punish for trying to find php
  res.redirect(301, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
}

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
