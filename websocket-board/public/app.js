let socket;
let noteCounter = 0;
let draggedNote = null;
const board = document.querySelector('.board');

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem('jwt', data.token);
            alert('Logged in successfully!');
            
            // Redirect to the board.html page
            window.location.href = '/board.html';
            
        } else {
            alert('Failed to login.');
        }
    });
}


async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with a ${response.status} status.`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            localStorage.setItem('currentUser', username,password);
            alert('Registered successfully!');
        } else {
            alert('Failed to register.');
        }
    })
    .catch(error => {
        console.error('Fetch error:', error.message);
    });
}

function updateBoardContent(noteId, content) {
    const note = document.getElementById(noteId);
    if (note) {
        note.querySelector('[contentEditable=true]').innerText = content;
    }
}

function setupBoardWebSocket(boardId) {
    const token = localStorage.getItem('jwt');
    
    if (!token) {
        return alert('Please log in first.');
    }

    socket = new WebSocket(`ws://localhost:8080?access_token=${token}&boardId=${boardId}`);

    socket.onopen = () => {
        console.log('Connected to the WebSocket.');
    };
    socket.onclose = () => {
        console.log('Disconnected from the WebSocket.');
    };
    socket.onmessage = function(event) {
        console.log('Received from server:', event.data);
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'NEW_NOTE_OR_EDIT':
                let note = document.getElementById(data.noteId);

                if (!note) { // If note doesn't exist, create it
                    note = document.createElement('div');
                    note.className = 'note';
                    note.id = data.noteId;
                    note.draggable = true;

                    const contentEditableDiv = document.createElement('div');
                    contentEditableDiv.contentEditable = 'true';
                    contentEditableDiv.addEventListener('input', handleNoteEdit);

                    note.appendChild(contentEditableDiv);
                    board.appendChild(note);
                    addDnDEventListeners(note);
                }

                const noteContentDiv = note.querySelector('div[contenteditable="true"]');
                if (noteContentDiv && noteContentDiv.innerText !== data.content) {
                    noteContentDiv.innerText = data.content;
                }
                break;

            case 'MOVE_NOTE':
                // ... (handle move note logic) ...
                break;
                case 'COLOR_CHANGE':
            const noteElement = document.getElementById(data.noteId);
            if (noteElement) {
                noteElement.style.backgroundColor = data.color;
            }
            break;
            
            default:
                console.error('Unknown message type:', data.type);
        }
    };
}

function handleNoteEdit(event) {
    console.log('Note edited:', event.target.innerText);
    const data = {
        type: 'NEW_NOTE_OR_EDIT',
        noteId: event.target.parentNode.id,  // Send the unique note ID
        content: event.target.innerText
    };
    socket.send(JSON.stringify(data));
}
function createNewNote(content = '') {
    const note = document.createElement('div');
    note.className = 'note';
    note.id = 'note-' + Date.now();  // Unique ID using timestamp
    note.draggable = true;

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'color-picker';
    colorPicker.addEventListener('change', handleColorChange);
    note.appendChild(colorPicker);

    const contentEditableDiv = document.createElement('div');
    contentEditableDiv.contentEditable = 'true';
    contentEditableDiv.innerText = content;
    contentEditableDiv.addEventListener('input', handleNoteEdit);
    note.appendChild(contentEditableDiv);

    // Add a click event to the note
    note.addEventListener('click', function(event) {
        // If clicked target is not the colorPicker, focus the contentEditableDiv
        if (event.target !== colorPicker) {
            contentEditableDiv.focus();
        }
    });

    board.appendChild(note);
    addDnDEventListeners(note);
}


function handleColorChange(event) {
    const note = event.target.parentNode;
    note.style.backgroundColor = event.target.value;

    // Constructing the data object
    const data = {
        type: 'COLOR_CHANGE',
        noteId: note.id,
        color: event.target.value
    };

    // Sending the data to the server via WebSocket
    socket.send(JSON.stringify(data));
}

function handleDragStart(e) {
    draggedNote = e.target;
    setTimeout(() => {
        e.target.classList.add('dragging'); // Add a class to indicate dragging
    }, 0);
}


function handleDragEnd(e) {
    e.target.classList.remove('dragging'); // Remove the dragging class
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}
function getDragAfterElement(e) {
    const notesArray = [...board.querySelectorAll('.note:not(.dragging)')];
    return notesArray.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function handleDrop(e) {
    e.preventDefault();
    if (draggedNote) {
        const afterElement = getDragAfterElement(e);
        let order;
        if (afterElement) {
            order = parseInt(afterElement.getAttribute('data-order')) + 1; 
            board.insertBefore(draggedNote, afterElement);
        } else {
            order = board.children.length + 1;
            board.appendChild(draggedNote);
        }
        draggedNote.setAttribute('data-order', order.toString());
        draggedNote.style.opacity = '';

        // Notify the server of the move
        if (socket) {
            const data = {
                type: 'MOVE_NOTE',
                noteId: draggedNote.id,
                order: order
            };
            socket.send(JSON.stringify(data));
        }
    }
}


function addDnDEventListeners(elem) {
    elem.addEventListener('dragstart', handleDragStart, false);
    elem.addEventListener('dragend', handleDragEnd, false);
    
}

window.addEventListener('DOMContentLoaded', (event) => {

    if (document.querySelector('.login')) {
        // Login page specific code
        // No additional code needed here for now.

    } else if (document.querySelector('.board')) {
        // Board page specific code

        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('boardId');
        board.addEventListener('dragover', handleDragOver);
        board.addEventListener('drop', handleDrop);

        if (boardId) {
            setupBoardWebSocket(boardId);
        }

        const addNoteBtn = document.getElementById('addNoteBtn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', function() {
                createNewNote();
            });
        }
    }

    const joinBoardBtn = document.getElementById('joinBoard');
    if (joinBoardBtn) {
        joinBoardBtn.addEventListener('click', function() {
            const boardId = document.getElementById('boardId').value;
            const token = localStorage.getItem('jwt');
            if (!token) {
                return alert('Please log in first.');
            }

            // Redirect to the board page with boardId as a query parameter
            window.location.href = `/board.html?boardId=${boardId}`;
        });
    }
});