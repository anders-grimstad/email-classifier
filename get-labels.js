#!/usr/bin/env node

/**
 * Gmail Label Discovery Script
 * Run this to get your actual Gmail label IDs
 */

import 'dotenv/config';
import { GmailClient } from './src/gmail-client.js';

async function getLabels() {
  try {
    console.log('📋 Getting your Gmail labels...\n');
    
    const gmailClient = new GmailClient();
    const labels = await gmailClient.getLabels();
    
    console.log('📧 Your Gmail Labels:');
    console.log('='.repeat(50));
    
    // Sort labels by type and name
    const userLabels = labels.filter(l => l.type === 'user').sort((a, b) => a.name.localeCompare(b.name));
    const systemLabels = labels.filter(l => l.type === 'system').sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('\n🏷️  USER LABELS (Custom):');
    userLabels.forEach(label => {
      console.log(`  ${label.name} -> ${label.id}`);
    });
    
    console.log('\n🔧 SYSTEM LABELS (Gmail built-in):');
    systemLabels.forEach(label => {
      console.log(`  ${label.name} -> ${label.id}`);
    });
    
    // Suggest config updates
    console.log('\n💡 SUGGESTED CONFIG UPDATES:');
    console.log('='.repeat(50));
    console.log('Update your src/config.js LABELS section with these IDs:');
    console.log('');
    
    // Try to find labels that might match our categories
    const categoryMap = {
      'TO_RESPOND': ['to respond', 'respond', 'action', 'urgent'],
      'FYI': ['fyi', 'info', 'information'],
      'COMMENT': ['comment', 'feedback'],
      'NOTIFICATION': ['notification', 'notify', 'alert'],
      'MEETING_UPDATE': ['meeting', 'calendar', 'event'],
      'MARKETING': ['marketing', 'promo', 'promotion', 'sales']
    };
    
    console.log('export const CONFIG = {');
    console.log('  LABELS: {');
    
    Object.entries(categoryMap).forEach(([category, keywords]) => {
      const matchingLabel = userLabels.find(label => 
        keywords.some(keyword => 
          label.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (matchingLabel) {
        console.log(`    ${category}: '${matchingLabel.id}', // ${matchingLabel.name}`);
      } else {
        console.log(`    ${category}: 'INBOX', // No matching label found - create one or use INBOX`);
      }
    });
    
    console.log('  }');
    console.log('};');
    
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Create missing labels in Gmail if needed');
    console.log('2. Update src/config.js with the correct label IDs');
    console.log('3. Or use INBOX for testing');
    
  } catch (error) {
    console.error('❌ Error getting labels:', error.message);
  }
}

getLabels();