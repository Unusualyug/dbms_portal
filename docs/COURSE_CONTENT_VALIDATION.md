# Official DBMS Course Content — Extraction & Validation Report

**Source:** `Course_File_DBMS.pdf` (12 scanned pages)  
**Course:** Database Management System: Organizing, Querying, and Managing Data — BETICE13305  
**Institution:** Gyanmanjari Innovative University / Gyanmanjari Institute of Technology  
**Program:** B. Tech., Semester 3  
**Extraction status:** complete; ordering follows the source table.  
**Practical total:** 52 (expected per module: 16 + 13 + 9 + 6 + 8).

## Validation summary

| Module | Official module title | Source pages | Theory items in portal manifest | Official practicals | Validation |
|---|---|---:|---:|---:|---|
| 1 | Introduction to Database Management Concept and SQL Basics | 2, 3 | 32 | 16 | ✅ count and numbering contiguous 1–16 |
| 2 | Database System Architecture and Ensuring Data Integrity | 4, 5 | 35 | 13 | ✅ count and numbering contiguous 1–13 |
| 3 | Advanced SQL and Normalization | 6, 7 | 38 | 9 | ✅ count and numbering contiguous 1–9 |
| 4 | PL/SQL and Database Security | 8 | 22 | 6 | ✅ count and numbering contiguous 1–6 |
| 5 | Advanced Concepts of SQL & Access Control | 9, 10, 11 | 26 | 8 | ✅ count and numbering contiguous 1–8 |

✅ All five modules imported in order  
✅ All 153 flattened topic/subtopic entries represented in the content manifest  
✅ All 52 practicals imported; practical numbers and ordering preserved  
✅ No additional practical questions have been added  
⚠️ Module 1 Practical 12 is transcribed with the scan’s internally inconsistent wording and is flagged for human verification; it has not been silently rewritten.

## Execution requirements identified from the syllabus

- **Primary lab dialect:** Oracle SQL and PL/SQL. Evidence includes Oracle data types, Oracle DB architecture, Oracle data dictionary views (`USER_TABLES`, `ALL_TABLES`), Oracle date functions, PL/SQL, Oracle privileges/roles, and Oracle Import/Export utilities.
- **Explicit secondary evaluation tool:** MySQL Workbench is named for Module 5 “Interactive Trigger Simulation Using MySQL Workbench.” The portal keeps this activity distinct from Oracle practical execution.
- **Safety/accuracy rule:** Judge0/SQLite/MySQL cannot be presented as Oracle execution. The app supports a server-side isolated Oracle lab adapter. If no Oracle lab is configured, it reports preflight/syntax status only and cannot mark an Oracle practical complete.
- The official PDF lists practical prompts but does **not** provide a per-topic quiz bank. Any seed quiz in the portal is labeled as an additional learning check derived from official topics—not as an official question from the PDF.

## Course details and learning outcomes

- **Prerequisite:** Basic Knowledge of Computer Programming
- **Type:** Professional Core and Professional Elective Courses
- **Hours / credits:** 90 / 5
- **Assessment marks:** SEE 100, CCE 50, total 150

### Course outcomes

- **CO1** — Understand foundational database concepts and Oracle SQL syntax to design, query, and manage relational databases effectively.
- **CO2** — Explore Oracle database architecture and implement data integrity through constraints, functions, and best practices in database design.
- **CO3** — Develop advanced SQL querying skills and apply normalization, transaction control, and database design principles for efficient and reliable data management.
- **CO4** — Apply PL/SQL programming constructs, including cursors and exception handling, to develop secure and efficient database applications.
- **CO5** — Implement advanced database features using stored procedures, triggers, transaction control, user management, and Oracle security privileges for effective database administration.

### Suggested Bloom’s taxonomy distribution

| Remember | Understand | Apply | Analyze | Evaluate | Create |
|---:|---:|---:|---:|---:|---:|
| 10% | 10% | 20% | 10% | 10% | 40% |

## Instructional method and references (PDF p. 12)

- The syllabus permits conventional blackboard teaching and, as appropriate, demonstrations, role play, quizzes, brainstorming, MOOCs and similar tools.
- **10% of topics** are suggested for flipped-mode instruction.
- Supplementary resources listed: online videos, NPTEL/SWAYAM videos, e-courses and a Virtual Laboratory.
- Internal evaluation is based on the Active Learning Assignment; the practical/viva examination is held at semester end to evaluate laboratory performance.

### Reference books

1. *Database System Concepts*, 6th Edition — Abraham Silberschatz, Henry F. Korth and S. Sudarshan, McGraw-Hill.
2. *SQL-PL/SQL* — Ivan Bayross, BPB Publication.
3. *Oracle 8i* — Jase A. Ramalho, BPB Publication.
4. *An Introduction to Database Systems* — C. J. Date, Pearson.
5. *Database Management System* — Ramakrishnan and Gehrke, Tata McGraw-Hill.

## Complete syllabus structure

### Module 1 — Introduction to Database Management Concept and SQL Basics

**Theory entries:** 32  
**Practical questions:** exactly 16  
**Hours / weightage:** 18 / 20%

#### Topics and subtopics

- **Data and database foundations:** Introduction; Data; Information; Data Items; Fields; Records; Files; Data Dictionary; Metadata; Database; Database Systems
- **DBMS:** Database Management System: Introduction; Purpose of a DBMS; Applications of a DBMS
- **Oracle and RDBMS:** Introduction to Oracle Database; RDBMS Architecture
- **DBMS products:** Open-source and Commercial DBMS; MySQL; Oracle; DB2; SQL Server
- **SQL basics:** Basics of SQL; Data Types in Oracle; SQL Categories; Data Definition Language (DDL): CREATE, ALTER, DROP; Data Manipulation Language (DML): INSERT, UPDATE, DELETE; Data Query Language (DQL): SELECT; Oracle Data Dictionary: USER_TABLES and ALL_TABLES
- **SQL clauses:** WHERE clause; ORDER BY clause; GROUP BY clause; HAVING clause

#### Official practical questions (source wording/order preserved)

1. Implement SQL queries for Creating and describing tables (CREATE, DESC). *(PDF p. 2)*
2. Implement SQL queries for Modifying tables using ALTER. *(PDF p. 2)*
3. Implement SQL queries for Deleting tables using DROP. *(PDF p. 2)*
4. Implement SQL queries for creating tables and insert sample data in tables. *(PDF p. 2)*
5. Implement SQL queries for Inserting and updating records using INSERT, UPDATE, DELETE. *(PDF p. 2)*
6. Implement SQL queries for Retrieving data using SELECT, WHERE, ORDER BY. *(PDF p. 2)*
7. Implement SQL queries using aggregate functions with GROUP BY and HAVING. *(PDF p. 2)*
8. Create Two tables' Students and Employees with 5 fields and stored actual data into the table using create and insert command. *(PDF p. 2)*
9. Create student tables with a few columns representing common data types (integer, text, date etc.) using DDL commands. *(PDF p. 2)*
10. Implement SQL Queries to perform DDL Commands (Create 5 tables and perform all the DDL operations upon them). *(PDF p. 2)*
11. Insert sample data into your tables using SQL INSERT statements. Verify the data has been inserted correctly. *(PDF p. 2)*
12. Implement SQL Queries to perform DDL Commands (Create minimum 10 records and perform modification operations upon them). ⚠️ *scan wording unclear; preserve pending instructor check* *(PDF p. 3)*
13. Practice DDL-create and DML-insert commands. *(PDF p. 3)*
14. Retrieve data using the SELECT command from table. *(PDF p. 3)*
15. Practice using SQL UPDATE and DELETE statements to modify data. *(PDF p. 3)*
16. Implement SQL queries for Understanding and browsing data dictionary USER_TABLES, ALL_TABLES. *(PDF p. 3)*

#### Assessment activities captured separately from practicals

- **Scenario-Based Case Simulation (20 marks):** A clinic database storing doctor and patient information. Design tables (DDL), populate them (DML), write queries using WHERE and GROUP BY to answer case questions (including patient counts per doctor and doctors treating more than three patients), and retrieve metadata such as USER_TABLES.
- **DBMS Vocabulary Crossword (10 marks):** Complete an individually provided DBMS-concepts crossword and upload the solved copy to the GMIU portal.

### Module 2 — Database System Architecture and Ensuring Data Integrity

**Theory entries:** 35  
**Practical questions:** exactly 13  
**Hours / weightage:** 18 / 20%

#### Topics and subtopics

- **Oracle architecture:** Architecture of Oracle; Instance; Database
- **DBMS components:** System Global Area (SGA); Program Global Area (PGA); Background Processes; Data Files; Control Files
- **Administration:** Database Administrator (DBA): Role and Responsibilities
- **Architecture concepts:** Database System Architecture; Data Abstraction; Data Independence; Logical Data Independence; Physical Data Independence; Types of DBMS; Centralized DBMS; Distributed DBMS
- **Integrity and constraints:** Data Integrity; Concept and Need of Constraints; Domain Constraints; NOT NULL; CHECK; Entity Constraints; UNIQUE; PRIMARY KEY; Referential Constraints; FOREIGN KEY
- **Predicates and functions:** IN Operator; LIKE; BETWEEN; Aggregate Functions; Inbuilt Functions; Numeric Functions; Date Functions; String Functions

#### Official practical questions (source wording/order preserved)

1. Apply primary keys and Not NULL constraints. *(PDF p. 4)*
2. Implementing NOT NULL, CHECK, UNIQUE. *(PDF p. 4)*
3. Using IN operator in queries. *(PDF p. 4)*
4. Perform queries involving predicates LIKE, BETWEEN, IN etc. *(PDF p. 4)*
5. Practice with numeric, date, and string inbuilt functions. *(PDF p. 4)*
6. Add constraints like Primary key, NOT NULL and UNIQUE to your tables. *(PDF p. 4)*
7. Use foreign keys to establish relationships between tables. *(PDF p. 4)*
8. Implement practical 1 again with referential constraint. *(PDF p. 4)*
9. Implement SQL queries using Date functions like add-months, months-between, round, next day, truncate, etc. *(PDF p. 4)*
10. Implement SQL queries using Numeric functions like abs, ceil, power, mod, round, trunc, sqrt, etc. *(PDF p. 4)*
11. Implement SQL queries and String Functions like initcap, lower, upper, rtrim, replace, substring, instr, etc. *(PDF p. 4)*
12. Implement SQL queries using Conversion functions like to-char, to-date, to-number. *(PDF p. 4)*
13. Implement SQL queries using Group functions like Avg, Min, Max, Sum, Count, etc. *(PDF p. 4)*

#### Assessment activities captured separately from practicals

- **Design and Justify Challenge (20 marks):** Build a student management system, select at least three constraints, and justify where and why each applies, including possible consequences if it is not applied.
- **Design Your Own Mini-Database (10 marks):** Choose a real-world scenario; design at least three entities and their table names, fields, types and constraints; identify primary/foreign-key relationships; add at least five sample records per table; write SELECT, WHERE, join and aggregate queries; prepare the specified report.

### Module 3 — Advanced SQL and Normalization

**Theory entries:** 38  
**Practical questions:** exactly 9  
**Hours / weightage:** 18 / 25%

#### Topics and subtopics

- **Joins:** Advanced Joins; Inner Join; Outer Join; Self Join
- **Subqueries:** Subqueries; Nested Queries; Correlated Subqueries
- **Set operations:** Set Operations; UNION; INTERSECT; MINUS
- **Database objects:** Views; Indexes; Sequences; Synonyms
- **SQL comparison operators:** EXISTS; ANY; ALL
- **Transaction control:** Transaction Control Commands; COMMIT; ROLLBACK; SAVEPOINT
- **Database design and normalization:** Introduction to Database Design; Functional Dependency; Normalization; 1NF; 2NF; 3NF; BCNF; Comparison of 3NF and BCNF; Multivalued Dependency; 4NF; 5NF (Project Join NF)
- **Transactions, recovery and utilities:** Transaction Processing; ACID Property; Serializability of Scheduling; Database Backup and Recovery; Oracle Utility: Import and Export

#### Official practical questions (source wording/order preserved)

1. To understand and implement various types of SQL joins — inner join, outer join (left, right, full), and self join. *(PDF p. 6)*
2. To learn how to retrieve and display combined data from multiple relational database tables using different types of SQL joins, thereby understanding data relationships and improving data querying efficiency. *(PDF p. 6)*
3. To practice the use of different types of subqueries — multiple-row, nested, and correlated — in SQL, enabling complex data extraction from multiple related tables based on dynamic or dependent conditions. *(PDF p. 6)*
4. To develop the skill to solve complex SQL queries using subqueries, including single-row and multiple-row subqueries, thereby enhancing query logic and data manipulation capabilities. *(PDF p. 6)*
5. To explore the usage of conditional operators EXISTS, ANY, and ALL in SQL for querying datasets with conditions involving comparisons against subquery results, supporting advanced decision-making in data retrieval. *(PDF p. 6)*
6. To understand and implement set operators — UNION, INTERSECT, and MINUS — for combining the results of multiple SQL queries and refining output by eliminating duplicates or performing comparisons between datasets. *(PDF p. 6)*
7. To demonstrate the creation and practical usage of database objects such as views (for virtual tables), indexes (for query performance optimization), and sequences (for auto-generating unique values), enhancing database design and efficiency. *(PDF p. 7)*
8. Demonstrating Transactions: COMMIT, ROLLBACK, SAVEPOINT. *(PDF p. 7)*
9. To perform database backup and recovery operations using export and import utilities, ensuring data protection and availability by understanding the process of safeguarding data in case of failure or loss. *(PDF p. 7)*

#### Assessment activities captured separately from practicals

- **Operation Data Phoenix: Rebuild & Secure the Crashed System (20 marks):** Rebuild a crashed hospital database from a partial backup, address an unnormalized schema and integrity issues related to unauthorized access, reconstruct the schema, query evidence with advanced SQL, use views/indexes/synonyms, simulate transactions, verify serializability, and prepare a backup/recovery plan. Submit the report.
- **Design a Mini Social Media Platform Database (10 marks):** Individually design a mini social-media database, create tables, insert sample data, and write queries for posts, likes, comments and followers.

### Module 4 — PL/SQL and Database Security

**Theory entries:** 22  
**Practical questions:** exactly 6  
**Hours / weightage:** 18 / 20%

#### Topics and subtopics

- **PL/SQL foundations:** Introduction to PL/SQL; PL/SQL Block Structure; Variables; Control Structures; Advantages of PL/SQL; SQL vs PL/SQL
- **Cursors:** Cursors; Implicit Cursor; Explicit Cursor; Cursor FOR Loop; Parameterized Cursor
- **Exception handling:** Exception Handling; Predefined Exceptions; User-defined Exceptions; Handling Raised Exceptions
- **Database security:** Database Security; Authentication; Authorization; Access Control; DAC (Discretionary Access Control); MAC (Mandatory Access Control); SQL Injection

#### Official practical questions (source wording/order preserved)

1. Implement basic PL/SQL blocks. *(PDF p. 8)*
2. Implement PL/SQL programs using IF STATEMENT. *(PDF p. 8)*
3. Implement PL/SQL programs using WHILE LOOP. *(PDF p. 8)*
4. Implement PL/SQL programs using IF, CASE, and loops. *(PDF p. 8)*
5. Implement PL/SQL programs with Cursor implementation (all types). *(PDF p. 8)*
6. Implement PL/SQL programs using Exception handling examples. *(PDF p. 8)*

#### Assessment activities captured separately from practicals

- **Mini Project Sprint (20 marks):** Work on a real-world project (for example, a college enrollment system): design a normalized schema, write PL/SQL procedures, handle exceptions, implement security features, and demonstrate data recovery and transaction control.
- **DBMS Error Hunt (10 marks):** Individually identify and correct intentional mistakes in a faulty database design, PL/SQL block or SQL queries, including redundant data, missing relationships and incorrect SQL syntax or logic.

### Module 5 — Advanced Concepts of SQL & Access Control

**Theory entries:** 26  
**Practical questions:** exactly 8  
**Hours / weightage:** 18 / 15%

#### Topics and subtopics

- **Program units and triggers:** Stored Procedures; Stored Functions; Packages; Triggers; Types of Triggers
- **Users and privileges:** Users: Create and Delete User; Data Control Language (DCL) Commands; GRANT; REVOKE; Oracle Database Privileges and Roles; System Privileges; Object Privileges; Assigning Privileges; Viewing Privileges; Revoking Privileges; Roles: Create, Grant, View and Delete
- **Transactions and locking:** Transaction Processing Language (TPL); BEGIN TRANSACTION; COMMIT; ROLLBACK; SAVEPOINT; ROLLBACK TO SAVEPOINT; Locking Strategies; Implicit Locking; Explicit Locking; LOCK TABLE Command

#### Official practical questions (source wording/order preserved)

1. Creating stored procedures and functions. *(PDF p. 10)*
2. Creating and using packages. *(PDF p. 10)*
3. Implement Cursor. *(PDF p. 10)*
4. Implement Trigger. *(PDF p. 10)*
5. Writing and testing triggers: BEFORE, AFTER, INSTEAD OF (Row/Statement-level). *(PDF p. 10)*
6. Creating and managing users: CREATE and DELETE USER. *(PDF p. 10)*
7. Using GRANT and REVOKE. *(PDF p. 10)*
8. Demonstrating transaction control with SAVEPOINT and rollback. *(PDF p. 10)*

#### Assessment activities captured separately from practicals

- **Code Optimization (20 marks):** Optimize and refactor two suboptimal Oracle PL/SQL programs or scripts (for example, procedures, functions, packages or triggers) to improve readability, maintainability, security and performance without changing output or behavior.
- **Interactive Trigger Simulation Using MySQL Workbench (10 marks):** In MySQL Workbench, create a table and trigger, perform INSERT/UPDATE/DELETE, observe automatic trigger execution, and document the trigger execution order. This named evaluation activity is kept distinct from the Oracle PL/SQL lab.

## Source transcription note

The PDF's Module 1 Practical 12 wording is internally inconsistent (it says DDL and then 'Create minimum 10 records'). The manifest preserves the scan's wording and does not reinterpret it.

The portal content is seeded from `server/src/seed/courseContent.json`. The same manifest feeds the student module pages, practical lab, seed process, validation script and this report; it is not duplicated in React components.
