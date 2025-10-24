/**
 * SQLite Helper - Universal database operations
 * Works with SQL.js for client-side database
 * 
 * Usage:
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>
 * <script src="sqlite-helper.js"></script>
 * <script>
 *   const db = await SQLiteHelper.init();
 *   await db.saveLocation({ lat: 40.7128, lon: -74.0060 });
 *   const history = await db.getHistory();
 * </script>
 */

const SQLiteHelper = (function() {
    'use strict';

    let db = null;
    let SQL = null;
    const DB_NAME = 'appDatabase';

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    async function init(config = {}) {
        const options = {
            dbName: config.dbName || DB_NAME,
            locateFile: config.locateFile || (file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`),
            autoSave: config.autoSave !== false,
            debug: config.debug || false
        };

        try {
            // Initialize SQL.js
            SQL = await initSqlJs({
                locateFile: options.locateFile
            });

            // Try to load existing database
            const savedDb = localStorage.getItem(options.dbName);
            if (savedDb) {
                const uint8Array = new Uint8Array(JSON.parse(savedDb));
                db = new SQL.Database(uint8Array);
                log('Loaded existing database');
            } else {
                db = new SQL.Database();
                log('Created new database');
            }

            // Create tables
            createTables();
            
            log('Database initialized successfully');

            // Auto-save on page unload
            if (options.autoSave) {
                window.addEventListener('beforeunload', () => saveDatabase(options.dbName));
            }

            return publicAPI;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    // ============================================================================
    // TABLE CREATION
    // ============================================================================
    function createTables() {
        // Locations table
        db.run(`
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL,
                altitude REAL,
                altitude_accuracy REAL,
                speed REAL,
                heading REAL,
                timestamp INTEGER NOT NULL,
                notes TEXT
            )
        `);

        // Media table (photos, videos, files)
        db.run(`
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                data TEXT NOT NULL,
                mime_type TEXT,
                size INTEGER,
                latitude REAL,
                longitude REAL,
                timestamp INTEGER NOT NULL,
                notes TEXT
            )
        `);

        // Create indexes for better performance
        db.run('CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp DESC)');
        db.run('CREATE INDEX IF NOT EXISTS idx_media_timestamp ON media(timestamp DESC)');
        db.run('CREATE INDEX IF NOT EXISTS idx_media_type ON media(type)');

        log('Tables created/verified');
    }

    // ============================================================================
    // LOCATION OPERATIONS
    // ============================================================================
    async function saveLocation(position) {
        if (!db) throw new Error('Database not initialized');

        try {
            const coords = position.coords || position;
            
            const stmt = db.prepare(`
                INSERT INTO locations 
                (latitude, longitude, accuracy, altitude, altitude_accuracy, speed, heading, timestamp, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                coords.latitude,
                coords.longitude,
                coords.accuracy || null,
                coords.altitude || null,
                coords.altitudeAccuracy || null,
                coords.speed || null,
                coords.heading || null,
                position.timestamp || Date.now(),
                position.notes || null
            ]);

            stmt.free();
            await saveDatabase();

            log('Location saved');
            return true;
        } catch (error) {
            console.error('Failed to save location:', error);
            return false;
        }
    }

    async function getLocations(limit = 100, offset = 0) {
        if (!db) throw new Error('Database not initialized');

        try {
            const results = db.exec(`
                SELECT * FROM locations 
                ORDER BY timestamp DESC 
                LIMIT ${limit} OFFSET ${offset}
            `);

            if (!results.length || !results[0].values.length) {
                return [];
            }

            return results[0].values.map(row => ({
                id: row[0],
                latitude: row[1],
                longitude: row[2],
                accuracy: row[3],
                altitude: row[4],
                altitudeAccuracy: row[5],
                speed: row[6],
                heading: row[7],
                timestamp: row[8],
                notes: row[9]
            }));
        } catch (error) {
            console.error('Failed to get locations:', error);
            return [];
        }
    }

    async function deleteLocation(id) {
        if (!db) throw new Error('Database not initialized');

        try {
            db.run('DELETE FROM locations WHERE id = ?', [id]);
            await saveDatabase();
            log('Location deleted:', id);
            return true;
        } catch (error) {
            console.error('Failed to delete location:', error);
            return false;
        }
    }

    // ============================================================================
    // MEDIA OPERATIONS
    // ============================================================================
    async function saveMedia(mediaData) {
        if (!db) throw new Error('Database not initialized');

        try {
            const stmt = db.prepare(`
                INSERT INTO media 
                (type, name, data, mime_type, size, latitude, longitude, timestamp, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                mediaData.type,
                mediaData.name || null,
                mediaData.data,
                mediaData.mimeType || null,
                mediaData.size || null,
                mediaData.latitude || null,
                mediaData.longitude || null,
                mediaData.timestamp || Date.now(),
                mediaData.notes || null
            ]);

            stmt.free();
            await saveDatabase();

            log('Media saved:', mediaData.type);
            return true;
        } catch (error) {
            console.error('Failed to save media:', error);
            return false;
        }
    }

    async function getMedia(type = null, limit = 50, offset = 0) {
        if (!db) throw new Error('Database not initialized');

        try {
            let query = 'SELECT * FROM media';
            if (type) {
                query += ` WHERE type = '${type}'`;
            }
            query += ` ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;

            const results = db.exec(query);

            if (!results.length || !results[0].values.length) {
                return [];
            }

            return results[0].values.map(row => ({
                id: row[0],
                type: row[1],
                name: row[2],
                data: row[3],
                mimeType: row[4],
                size: row[5],
                latitude: row[6],
                longitude: row[7],
                timestamp: row[8],
                notes: row[9]
            }));
        } catch (error) {
            console.error('Failed to get media:', error);
            return [];
        }
    }

    async function deleteMedia(id) {
        if (!db) throw new Error('Database not initialized');

        try {
            db.run('DELETE FROM media WHERE id = ?', [id]);
            await saveDatabase();
            log('Media deleted:', id);
            return true;
        } catch (error) {
            console.error('Failed to delete media:', error);
            return false;
        }
    }

    // ============================================================================
    // DATABASE MANAGEMENT
    // ============================================================================
    async function saveDatabase(dbName = DB_NAME) {
        if (!db) return;

        try {
            const data = db.export();
            const buffer = Array.from(data);
            localStorage.setItem(dbName, JSON.stringify(buffer));
            log('Database saved to localStorage');
        } catch (error) {
            console.error('Failed to save database:', error);
        }
    }

    async function clearAllData() {
        if (!db) throw new Error('Database not initialized');

        try {
            db.run('DELETE FROM locations');
            db.run('DELETE FROM media');
            db.run('VACUUM');
            await saveDatabase();
            log('All data cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    }

    async function exportData(format = 'json') {
        if (!db) throw new Error('Database not initialized');

        try {
            const locations = await getLocations(10000);
            const media = await getMedia(null, 10000);

            const data = {
                locations,
                media,
                exportDate: new Date().toISOString()
            };

            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            } else if (format === 'csv') {
                return convertToCSV(locations);
            }

            return data;
        } catch (error) {
            console.error('Failed to export data:', error);
            return null;
        }
    }

    async function importData(jsonData) {
        if (!db) throw new Error('Database not initialized');

        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            // Import locations
            if (data.locations && Array.isArray(data.locations)) {
                for (const loc of data.locations) {
                    await saveLocation(loc);
                }
            }

            // Import media
            if (data.media && Array.isArray(data.media)) {
                for (const item of data.media) {
                    await saveMedia(item);
                }
            }

            log('Data imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    async function getStats() {
        if (!db) throw new Error('Database not initialized');

        try {
            const locationCount = db.exec('SELECT COUNT(*) FROM locations')[0].values[0][0];
            const mediaCount = db.exec('SELECT COUNT(*) FROM media')[0].values[0][0];
            const photoCount = db.exec("SELECT COUNT(*) FROM media WHERE type = 'photo'")[0].values[0][0];
            const fileCount = db.exec("SELECT COUNT(*) FROM media WHERE type = 'file'")[0].values[0][0];

            return {
                locations: locationCount,
                media: mediaCount,
                photos: photoCount,
                files: fileCount
            };
        } catch (error) {
            console.error('Failed to get stats:', error);
            return null;
        }
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================
    function convertToCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value}"` : value;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    function log(...args) {
        console.log('[SQLite Helper]', ...args);
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================
    const publicAPI = {
        // Location operations
        saveLocation,
        getLocations,
        deleteLocation,

        // Media operations
        saveMedia,
        getMedia,
        deleteMedia,

        // Database management
        save: saveDatabase,
        clear: clearAllData,
        export: exportData,
        import: importData,
        stats: getStats,

        // Direct DB access (advanced)
        getDB: () => db,
        query: (sql, params = []) => {
            if (!db) throw new Error('Database not initialized');
            return db.exec(sql, params);
        }
    };

    return {
        init,
        ...publicAPI
    };
})();

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SQLiteHelper;
}