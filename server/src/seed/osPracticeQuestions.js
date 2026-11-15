// Supplementary, portal-authored learning checks derived from the official OS syllabus.
// The course file does not supply an official per-topic MCQ bank; these are not official exam questions.
module.exports = [
  {
    key: "os-m1-q1",
    moduleNumber: 1,
    topicKey: "os-m1-os-purpose",
    title: "Why an operating system?",
    prompt:
      "Which statement best describes a core purpose of an operating system?",
    type: "mcq",
    options: [
      { id: "a", text: "It only translates source code into machine code." },
      {
        id: "b",
        text: "It manages hardware resources and provides services to programs.",
      },
      { id: "c", text: "It replaces all application software." },
      {
        id: "d",
        text: "It stores every program permanently in CPU registers.",
      },
    ],
    correctAnswer: "b",
    explanation:
      "An operating system manages resources such as the CPU, memory, devices, and files, and provides common services to applications.",
  },
  {
    key: "os-m1-q2",
    moduleNumber: 1,
    topicKey: "os-m1-unix-architecture",
    title: "Kernel boundary",
    prompt: "What is the role of a system call in a UNIX-like system?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "It is a controlled request from a user program for an OS service.",
      },
      { id: "b", text: "It is a command-history file." },
      { id: "c", text: "It is a type of directory." },
      { id: "d", text: "It is a shell prompt theme." },
    ],
    correctAnswer: "a",
    explanation:
      "System calls form the interface through which user programs request kernel services such as file and process operations.",
  },
  {
    key: "os-m1-q3",
    moduleNumber: 1,
    topicKey: "os-m1-files-directories",
    title: "Working directory",
    prompt: "Which command prints the current working directory?",
    type: "mcq",
    options: [
      { id: "a", text: "pwd" },
      { id: "b", text: "mkdir" },
      { id: "c", text: "touch" },
      { id: "d", text: "whoami" },
    ],
    correctAnswer: "a",
    explanation: "pwd prints the path of the current working directory.",
  },
  {
    key: "os-m1-q4",
    moduleNumber: 1,
    topicKey: "os-m1-shell-io-conditionals",
    title: "File attribute test",
    prompt:
      "In a shell test expression, which operator checks whether a path is a regular file?",
    type: "mcq",
    options: [
      { id: "a", text: "-d" },
      { id: "b", text: "-f" },
      { id: "c", text: "-x" },
      { id: "d", text: "-s" },
    ],
    correctAnswer: "b",
    explanation:
      "-f tests whether a path exists and is a regular file; -d checks for a directory.",
  },
  {
    key: "os-m2-q1",
    moduleNumber: 2,
    topicKey: "os-m2-process-concept",
    title: "Process vs. program",
    prompt: "Which statement distinguishes a process from a program?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "A process is a program in execution with state and resources.",
      },
      { id: "b", text: "A process is always stored only on a USB drive." },
      { id: "c", text: "A program can never create a process." },
      { id: "d", text: "They are different names for a CPU register." },
    ],
    correctAnswer: "a",
    explanation:
      "A program is passive code; a process is an executing instance with state and allocated resources.",
  },
  {
    key: "os-m2-q2",
    moduleNumber: 2,
    topicKey: "os-m2-process-relations-calls",
    title: "Creating a UNIX process",
    prompt:
      "Which UNIX system call is conventionally used to create a child process?",
    type: "mcq",
    options: [
      { id: "a", text: "fork()" },
      { id: "b", text: "printf()" },
      { id: "c", text: "malloc()" },
      { id: "d", text: "grep()" },
    ],
    correctAnswer: "a",
    explanation:
      "fork() creates a child process; exec-family calls can then replace a process image with another program.",
  },
  {
    key: "os-m2-q3",
    moduleNumber: 2,
    topicKey: "os-m2-cpu-algorithms",
    title: "Round Robin quantum",
    prompt: "What does the time quantum control in Round Robin scheduling?",
    type: "mcq",
    options: [
      { id: "a", text: "The maximum number of files a process may open." },
      {
        id: "b",
        text: "The time a process may run before the scheduler moves to another ready process.",
      },
      { id: "c", text: "The amount of disk space reserved for a process." },
      { id: "d", text: "The number of threads in a program." },
    ],
    correctAnswer: "b",
    explanation:
      "Round Robin gives each ready process a bounded CPU time slice called a time quantum.",
  },
  {
    key: "os-m2-q4",
    moduleNumber: 2,
    topicKey: "os-m2-pcb-context-switch",
    title: "Process Control Block",
    prompt: "Why does the operating system use a Process Control Block (PCB)?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "To store information needed to manage and resume a process.",
      },
      { id: "b", text: "To compress every file opened by the process." },
      { id: "c", text: "To replace the process with a shell script." },
      { id: "d", text: "To assign the process a DNS name." },
    ],
    correctAnswer: "a",
    explanation:
      "A PCB stores process state, identifiers, scheduling details, and saved execution context.",
  },
  {
    key: "os-m3-q1",
    moduleNumber: 3,
    topicKey: "os-m3-noncontiguous-memory",
    title: "Paging units",
    prompt: "In paging, what is the relationship between a page and a frame?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "Pages are virtual-memory blocks; frames are same-sized physical-memory blocks.",
      },
      {
        id: "b",
        text: "Pages are CPU registers and frames are shell variables.",
      },
      { id: "c", text: "A frame is always larger than every page." },
      { id: "d", text: "They are file-compression formats." },
    ],
    correctAnswer: "a",
    explanation:
      "Paging divides virtual address spaces into pages and physical memory into same-sized frames.",
  },
  {
    key: "os-m3-q2",
    moduleNumber: 3,
    topicKey: "os-m3-page-replacement",
    title: "FIFO page replacement",
    prompt: "Which page does FIFO replace when it needs a frame?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "The page that was loaded earliest among the resident pages.",
      },
      {
        id: "b",
        text: "The page with the smallest physical address in every case.",
      },
      {
        id: "c",
        text: "The page that will never be used again, using future knowledge.",
      },
      { id: "d", text: "The newest page only." },
    ],
    correctAnswer: "a",
    explanation:
      "FIFO replaces the resident page that has been in memory the longest since it was loaded.",
  },
  {
    key: "os-m3-q3",
    moduleNumber: 3,
    topicKey: "os-m3-page-replacement",
    title: "Optimal replacement",
    prompt: "Why is Optimal page replacement mainly used as a benchmark?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "It requires knowing future page references, which a real OS generally cannot know exactly.",
      },
      { id: "b", text: "It never uses frames." },
      { id: "c", text: "It applies only to shell variables." },
      { id: "d", text: "It replaces every page after one instruction." },
    ],
    correctAnswer: "a",
    explanation:
      "Optimal evicts the page whose next use is farthest in the future, providing a comparison bound but requiring future knowledge.",
  },
  {
    key: "os-m3-q4",
    moduleNumber: 3,
    topicKey: "os-m3-unix-filters",
    title: "Command pipeline",
    prompt: "What does the pipe operator (|) do in a UNIX shell?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "Sends one command’s standard output to another command’s standard input.",
      },
      { id: "b", text: "Deletes the current directory." },
      { id: "c", text: "Starts a new login session." },
      { id: "d", text: "Changes a file permission." },
    ],
    correctAnswer: "a",
    explanation:
      "A pipe connects the output stream of one command to the input stream of the next command.",
  },
  {
    key: "os-m4-q1",
    moduleNumber: 4,
    topicKey: "os-m4-deadlock",
    title: "Deadlock conditions",
    prompt: "Which item is one of the four necessary conditions for deadlock?",
    type: "mcq",
    options: [
      { id: "a", text: "Circular wait" },
      { id: "b", text: "Page coloring" },
      { id: "c", text: "File compression" },
      { id: "d", text: "Round-robin rotation" },
    ],
    correctAnswer: "a",
    explanation:
      "The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait.",
  },
  {
    key: "os-m4-q2",
    moduleNumber: 4,
    topicKey: "os-m4-bankers",
    title: "Safe state",
    prompt: "What does a safe state mean in the context of Banker’s algorithm?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "There exists an order in which every process can obtain its remaining resources and finish.",
      },
      {
        id: "b",
        text: "Every process is currently running on a separate CPU.",
      },
      { id: "c", text: "No process has been allocated resources." },
      { id: "d", text: "All resource requests are permanently denied." },
    ],
    correctAnswer: "a",
    explanation:
      "A safe state has at least one safe sequence that lets processes finish with the available and subsequently released resources.",
  },
  {
    key: "os-m4-q3",
    moduleNumber: 4,
    topicKey: "os-m4-sync-mechanisms",
    title: "Mutual exclusion",
    prompt: "What is the main purpose of mutual exclusion?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "To prevent multiple processes from entering a protected critical section simultaneously.",
      },
      {
        id: "b",
        text: "To guarantee that every program uses the same CPU burst.",
      },
      { id: "c", text: "To compress shared memory." },
      { id: "d", text: "To create a new user account." },
    ],
    correctAnswer: "a",
    explanation:
      "Mutual exclusion protects shared state by allowing only one participant in a critical section at a time.",
  },
  {
    key: "os-m4-q4",
    moduleNumber: 4,
    topicKey: "os-m4-classical-ipc",
    title: "Bounded buffer",
    prompt:
      "In the producer–consumer problem, what must synchronization protect?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "The shared buffer and the conditions for empty/full slots.",
      },
      { id: "b", text: "Only the hostname string." },
      { id: "c", text: "The file extension of each program." },
      { id: "d", text: "Only the CPU clock rate." },
    ],
    correctAnswer: "a",
    explanation:
      "Synchronization coordinates access to the shared buffer and prevents producers from overfilling it or consumers from reading it while empty.",
  },
  {
    key: "os-m5-q1",
    moduleNumber: 5,
    topicKey: "os-m5-disk-scheduling",
    title: "SSTF selection",
    prompt: "What request does SSTF normally choose next?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "The pending request closest to the current disk-head position.",
      },
      { id: "b", text: "The oldest request regardless of position." },
      { id: "c", text: "The last request in the list every time." },
      { id: "d", text: "The request with the largest file size." },
    ],
    correctAnswer: "a",
    explanation:
      "SSTF chooses the request with the shortest seek distance from the current head position.",
  },
  {
    key: "os-m5-q2",
    moduleNumber: 5,
    topicKey: "os-m5-security-threats",
    title: "Authentication vs authorization",
    prompt:
      "Which statement correctly distinguishes authentication from authorization?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "Authentication verifies identity; authorization determines permitted actions.",
      },
      {
        id: "b",
        text: "Authentication compresses files; authorization decompresses them.",
      },
      { id: "c", text: "They both mean listing directory contents." },
      {
        id: "d",
        text: "Authorization must happen before any identity exists.",
      },
    ],
    correctAnswer: "a",
    explanation:
      "Authentication answers who a user is; authorization determines what that authenticated identity may access.",
  },
  {
    key: "os-m5-q3",
    moduleNumber: 5,
    topicKey: "os-m5-access-control",
    title: "Access Control List",
    prompt: "What does an Access Control List (ACL) describe?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "Which users or groups may perform specified operations on an object.",
      },
      { id: "b", text: "The order of CPU scheduling algorithms." },
      { id: "c", text: "A list of page faults only." },
      { id: "d", text: "A sequence of shell prompts." },
    ],
    correctAnswer: "a",
    explanation:
      "An ACL associates an object with users or groups and the access operations allowed to each.",
  },
  {
    key: "os-m5-q4",
    moduleNumber: 5,
    topicKey: "os-m5-shell-file-tools",
    title: "Compression and archiving",
    prompt: "Which statement best distinguishes compression from archiving?",
    type: "mcq",
    options: [
      {
        id: "a",
        text: "Compression reduces data size; archiving packages files together.",
      },
      {
        id: "b",
        text: "Compression creates processes; archiving schedules the CPU.",
      },
      { id: "c", text: "They are identical operations in every tool." },
      { id: "d", text: "Archiving always deletes the originals." },
    ],
    correctAnswer: "a",
    explanation:
      "gzip compresses data; tar commonly packages multiple files into an archive, and those tasks can be combined.",
  },
];
