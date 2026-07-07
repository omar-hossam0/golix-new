#!/usr/bin/env node
/**
 * Verification script for Birth Years & Groups Refactor
 */
require('dotenv').config();
const db = require('../src/infrastructure/database');

async function verify() {
    console.log('Verifying Birth Years & Groups Refactor...\n');
    
    try {
        // Check birth_years columns
        const byColumns = await db.raw(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'academy_birth_years'
        `);
        console.log('✓ Birth years columns:', byColumns.rows.map(r => r.column_name).join(', '));
        
        // Check groups columns
        const gColumns = await db.raw(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'academy_groups'
        `);
        console.log('✓ Groups columns:', gColumns.rows.map(r => r.column_name).join(', '));
        
        // Check group_labels table
        const glExists = await db.schema.hasTable('group_labels');
        console.log('✓ Group labels table exists:', glExists);
        
        console.log('\n✓ Verification complete!');
    } catch (err) {
        console.error('✗ Verification failed:', err.message);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

verify();
