

const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const { useState } = require('react');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'dbsop.crclrhhtf2hs.eu-north-1.rds.amazonaws.com',
  port: '3306',
  user: 'admin',
  password: 'Rdssop123',
  database: 'SOP'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to the database');
  }
});


app.get('/methoddetails/:requiredMethod', (req, res) => {
  const methodName = req.params.requiredMethod; // Get methodName from URL parameter
  console.log(methodName);

  // Replace with your actual database query to retrieve method details
  const query = 'SELECT method_name, method_id, method_maker_name, method_date FROM created_methods WHERE method_name = ?'; // Modify this query

  db.query(query, [methodName], async (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const methodDetailsArray = results.map(result => ({
          method_name: result.method_name,
          method_id: result.method_id,
          method_maker_name: result.method_maker_name,
          method_date: result.method_date
          // Add more queries or processing as needed
        }));


        console.log(methodDetailsArray);
        res.json(methodDetailsArray);
      } else {
        res.status(404).json({ error: 'Method not found' });
      }
    }
  });
});



app.post('/methods', async (req, res) => {
  try {
    const { methodId, userId, methodMaker, methodName, creationDate, questions } = req.body;

    console.log("workingvarible", methodMaker);

    // Start a transaction
    await new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Insert survey data into the 'surveys' table
    const surveyQuery = 'INSERT INTO created_methods (method_id, method_name, method_maker_id, method_maker_name, method_date) VALUES (?, ?, ?, ?, ?)';
    await db.query(surveyQuery, [methodId, methodName, userId, methodMaker, creationDate]);

    // Insert questions into the 'questions' table using Promise.all
    const questionsQuery = 'INSERT INTO questions (method_id, question_text) VALUES (?, ?)';
    await Promise.all(
      questions.map(async (question) => {
        await db.query(questionsQuery, [methodId, question.text]);
      })
    );

    // Commit the transaction
    await new Promise((resolve, reject) => {
      db.commit((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({ message: 'Survey created successfully' });
  } catch (error) {
    console.error('Error creating survey:', error);
    // Rollback the transaction in case of an error
    await new Promise((resolve) => db.rollback(() => resolve()));
    res.status(500).json({ error: 'Error creating survey' });
  }
});

// Import necessary modules

app.post("/surveyresponses", async (req, res) => {
  const { responseId, responderUserId, methodMakerUserId, methodId, methodName, responseDate, responses } = req.body;

  try {
    console.log("Inserting or updating responses and photos...");

    await new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const checkQuery = `SELECT * from responses where responder_user_id = ? AND method_responded_id =?`;

    const checkQueryParams = [responderUserId, methodId];

    db.query(checkQuery, checkQueryParams, async (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Database query error' });
      } else {
        if (results.length > 0) {

          const updateResponseQuery = `UPDATE responses
          SET 
              response_id = ?,
              responded_to_id = ?,
              method_responded_name = ?,
              response_date = ?
          WHERE responder_user_id = ? AND method_responded_id = ?
        `;

          const updateResponseParams = [responseId, methodMakerUserId, methodName, responseDate, responderUserId, methodId];

          await db.query(updateResponseQuery, updateResponseParams);





        } else {
          // Insert the response details into the responses table
          const insertResponseQuery = `
              INSERT INTO responses (response_id, responder_user_id, responded_to_id, method_responded_id, method_responded_name, response_date)
              VALUES (?, ?, ?, ?, ?, ?)

          `;

          // Use this query in your code to insert or update responses.


          const insertResponseParams = [responseId, responderUserId, methodMakerUserId, methodId, methodName, responseDate];

          await db.query(insertResponseQuery, insertResponseParams);
        }
      }
    });

    // Insert or update answers in the answers table
    const insertAnswerQuery = `
          INSERT INTO answers (response_id, responder_user_id, method_responded_id, question_id, question_text, answer, comments, photo_upload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

    await Promise.all(
      responses.map(async (response) => {
        const { question_id, question_text, answer_text, comments, photo_upload } = response;
        console.log(`Inserting or updating response for question ID ${question_id}`);

        const queryParams = [responseId, responderUserId, methodId, question_id, question_text, answer_text, comments, photo_upload];

       
        try {
           // Check if a row with the same response_id, responder_user_id, method_responded_id, and question_id exists
            const checkAnswerQuery = `
            SELECT * FROM answers
            WHERE responder_user_id = ? AND method_responded_id = ?
          `;
          console.log("responder user id ", responderUserId);
          console.log("method id ", methodId)
          const checkAnswerParams = [responderUserId, methodId];

          const existingAnswer = await db.query(checkAnswerQuery, checkAnswerParams);
          console.log(existingAnswer.length);

          if (existingAnswer.length > 0) {
            // If a matching row exists, update it
            const updateAnswerQuery = `
              UPDATE answers
              SET
                question_text = ?,
                answer = ?,
                comments = ?,
                photo_upload = ?
              WHERE responder_user_id = ? AND method_responded_id = ? 
            `;

            const updateAnswerParams = [question_id, question_text, answer_text, comments, photo_upload, responderUserId, methodId];

            db.query(updateAnswerQuery, updateAnswerParams);
          } else {
            // If no matching row exists, insert a new row
            await db.query(insertAnswerQuery, queryParams);
          }

          console.log(`Inserted or updated response for question ID ${question_id}`);
        } catch (error) {
          console.error('Error inserting or updating response:', error);
          // Handle the error appropriately
        }
      })
    );

    await new Promise((resolve, reject) => {
      db.commit((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log("Responses and photos inserted or updated successfully");
    res.json({ message: "Responses and photos inserted or updated successfully" });
  } catch (error) {
    console.error("Error inserting or updating responses and photos:", error);
    await new Promise((resolve) => db.rollback(() => resolve()));
    res.status(500).json({ error: "Error inserting or updating responses and photos" });
  }
});




app.get('/surveydetails/:methodId', (req, res) => {
  const methodId = req.params.methodId; // Get methodId from URL parameter

  // Replace with your actual database query to retrieve survey details
  const query = 'SELECT * FROM created_methods WHERE method_id = ?'; // Modify this query

  db.query(query, [methodId], async (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const surveyDetails = results[0];
        const questionsQuery = 'SELECT * FROM questions WHERE method_id = ?';
        const questions = await new Promise((resolve, reject) => {
          db.query(questionsQuery, [methodId], (err, questionResults) => {
            if (err) {
              reject(err);
            } else {
              resolve(questionResults);
            }
          });
        });
        surveyDetails.questions = questions;
        console.log("means backend is working",surveyDetails);
        res.json(surveyDetails);
      } else {
        res.status(404).json({ error: 'Survey not found' });
      }
    }
  });
});

app.get('/methods/:userId', (req, res) => {
  const userId = req.params.userId; // Get userId from URL parameter

  // Replace with your actual database query to retrieve survey details
  const query = 'SELECT * FROM created_methods WHERE method_maker_id = ?'; // Modify this query

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const methodsArray = [];
         // Iterate through the database results and create an object for each method
         results.forEach((row) => {
          const method = {
            methodId: row.method_id, // Customize these fields based on your database schema
            methodName: row.method_name,
            methodDate: row.method_date
          };

          // Push the method object into the methodsArray
          methodsArray.push(method);
        });
        console.log("thearray",methodsArray);
        res.json(methodsArray);
        // const existingMethods = results[0];
        // res.json(existingMethods);
      } else {
        res.status(404).json({ error: 'Survey not found' });
      }
    }
  });
});


app.get('/responses/:methodId', (req, res) => {
  const methodId = req.params.methodId; // Get methodId from URL parameter

  // Replace with your actual database query to retrieve survey details
  const query = 'SELECT * FROM responses WHERE method_responded_id = ?'; // Modify this query

  db.query(query, [methodId], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const methodsArray = [];
         // Iterate through the database results and create an object for each method
         results.forEach((row) => {
          const method = {
            responseid: row.response_id,
            responderId: row.responder_user_id, // Customize these fields based on your database schema
            responseDate: row.response_date,
          };

          // Push the method object into the methodsArray
          methodsArray.push(method);
        });
        console.log("thearray",methodsArray);
        res.json(methodsArray);
        // const existingMethods = results[0];
        // res.json(existingMethods);
      } else {
        res.status(404).json({ error: 'Survey not found' });
      }
    }
  });
});


app.get('/answers/:responseId', (req, res) => {
  const responseId = req.params.responseId; // Get responseId from URL parameter

  // Replace with your actual database query to retrieve survey details
  const query = 'SELECT * FROM answers WHERE response_id = ?'; // Modify this query

  db.query(query, [responseId], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const answersArray = [];

        // Iterate through the database results and create an object for each method
        results.forEach((row) => {
          const answers = {
            responderid: row.responder_user_id,
            question_id: row.question_id,
            question: row.question_text,
            answer: row.answer, // Customize these fields based on your database schema
            comments: row.comments,
            photo: row.photo_upload // Convert Buffer to Base64
          };

          // Push the answers object into the answersArray
          answersArray.push(answers);
        });

        res.json(answersArray);
      } else {
        res.status(404).json({ error: 'Survey not found' });
      }
    }
  });
});



app.get('/yourrespondedmethods/:userId', (req, res) => {
  const userId = req.params.userId; // Get userId from URL parameter

  // Replace with your actual database query to retrieve survey details
  const query = 'SELECT * FROM responses WHERE responder_user_id = ?'; // Modify this query

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database query error' });
    } else {
      if (results.length > 0) {
        const yourResponseArray = [];
         // Iterate through the database results and create an object for each method
         results.forEach((row) => {
          const answers = {
            responseid: row.response_id,
            respondedUserId: row.responded_to_id,
            methodId: row.method_responded_id,
            methodName: row.method_responded_name, // Customize these fields based on your database schema
            responseDate: row.response_date
          };


          // Push the answers object into the yourResponseArray
          yourResponseArray.push(answers);
        });
        console.log("thearray",yourResponseArray);
        res.json(yourResponseArray);
        // const existingMethods = results[0];
        // res.json(existingMethods);
      } else {
        res.status(404).json({ error: 'Survey not found' });
      }
    }
  });
});

app.listen(8081, () => {
  console.log('Backend server is running on port 8081');
});
