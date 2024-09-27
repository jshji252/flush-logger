import { appendFile } from "fs/promises";
import { Subject, bufferTime, concatMap, map } from "rxjs";

// pathToLog: path to the log file
// timeLimit (int): time limit for each batch in ms
// logEntryLimit (int): maximum number of logs in each batch
export function FlushLogger(pathToLog, timeLimit, logEntryLimit, fns){
  if (pathToLog === undefined || typeof pathToLog !== "string") {
    throw new Error("Invalid log path; IS FATAL; THROW");
  }

  if (timeLimit == undefined) timeLimit = 2000;
  if (logEntryLimit == undefined) logEntryLimit = 20;
  if (fns == undefined) fns = [];
  if (!Array.isArray(fns)) fns = [fns];

  // Function to write log entry to a file
  async function writeLogToFileInBatch(logLines) {
    let ii = 0, success = false;

    while (!success && ii++ < 3) {
      try {
        await appendFile(pathToLog, logLines);
        success = true;
      } catch (err) {
        // ?? do you not trust 'appendFile'?
        // Dad said never trust anyone!
        await appendFile(pathToLog, "ERROR! retrying..\n");
        console.error("Error writing log:", err);
      }
    }
  }

  // the workhorse
  const _logSubject = new Subject();
  _logSubject
    .pipe(
      bufferTime(timeLimit, null, logEntryLimit),

      // user defined transformers
      ...fns.map(f => map(f)),

      // `concatMap` ensures that logs are written sequentially, one at a time
      concatMap((logEntry) => writeLogToFileInBatch(logEntry)),
    )
    .subscribe({
      error: (err) => console.error("Error logging:", err),
      complete: () => console.log("Logging completed"),
    });

  // Create a log function that pushes logs into the subject
  return function logMessage(message, uid = "default") {
    const logEntry = {
      uid,
      message,
      timestamp: Date.now(),
    };
    _logSubject.next(logEntry);
  }
}

// Just a helper that the author uses.
export function logEntriesToString (logEntries){
  return logEntries
    .map(({uid, message, timestamp}) => `[${uid}] ${timestamp} >> ${message}\n`)
    .join('');
}

//
// const logger = FlushLogger("log.txt", 5000, 500, [logEntriesToString]);
//
// setInterval(() => {
//   logger("Hello World! " + Math.floor(Math.random()*100), "abc");
// }, 200);
