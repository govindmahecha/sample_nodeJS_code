#! /usr/bin/env node
var args = process.argv.slice(2);

const path = require('path');
const dotenv = require('dotenv');
const mongoose   = require('mongoose');
const Ask = require('../models/Ask');
const Community = require('../models/Community');
const Reply = require('../models/Reply');
const Offer = require('../models/Offer');
const Tag = require('../models/Tag');
const User = require('../models/User');
const async = require('async');

dotenv.load({ path: path.join(__dirname, './../../.env') });

(async function(){

	console.log('process.env.MONGODB_URI', process.env.MONGODB_URI);
	mongoose.connect(process.env.MONGODB_URI, {
		"keepAlive" : true,
		"connectTimeoutMS" : 30000,
		"useNewUrlParser" : true
	});
	mongoose.connection.on('error', (err) => {
	  console.error(err);
	  console.log('%s MongoDB connection error. Please make sure MongoDB is running.');
	  process.exit();
	});

	if (args[0] == 'drop'){
		console.log('drop');
		try {
			await Ask.collection.drop();
			await Community.collection.drop();
			await Offer.collection.drop();
			await Reply.collection.drop();
			await Tag.collection.drop();
			await User.collection.drop();
		} catch(e){ }
	}

	let demoCommunity = new Community({
		name : 'GSB Accelerate'
	});
	await demoCommunity.save();
	console.log('demoCommunity', demoCommunity);

	var amit = new User({
		email : 'amit101@alumni.gsb.stanford.edu',
		password: 'msx18admin',
		isEmailVerified : true,
		profile : {
			name : 'Amit Kumar',
			emails : [{
				email : 'amit101@alumni.gsb.stanford.edu'
			}]
		},
		isAdmin : true,
		communities : [ demoCommunity ]
	});
	await amit.save();

	demoCommunity.admins.push(amit._id);
	await demoCommunity.save();

	const demoSeed = require('./demo-seed-data');

	for (var user of demoSeed){
		var userModel = new User({
			email : user['Email Address'],
			password : 'msx18',
			profile : {
				name : user['Name'],
				linkedInUrl : user["LinkedIn Profile (so we have everyone's in one place)"],
				emails : [{
					email : user['Email Address']
				}],
				postGraduationPlans : user["What are your general career plans post-graduation? (If you have no clear plans, don't panic! Share what areas you're exploring instead.)"]
			},
			communities : [ demoCommunity ]
		});
		
		await userModel.save();

		var ask1Prompt = 'Are there any sectors/companies/people are you currently looking to be connected to?';		
		if (user[ask1Prompt]){
			let ask = new Ask({
				owner : userModel,
				prompt : {
					community : demoCommunity,
					value : ask1Prompt
				},
				body : user[ask1Prompt],
				tags : user['ASK: Sector'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
			});
			await ask.save();
		}

		var ask2Prompt = 'What resources or support would be helpful in your current search? (resume review, interview prep, industry advice, offer evaluations, term sheet evaluations, etc.)';
		if (user[ask2Prompt]){
			let ask = new Ask({
				owner : userModel,
				prompt : {
					community : demoCommunity,
					value : ask2Prompt
				},
				body : user[ask2Prompt],
				tags : user['ASK: Resources / Support'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
			});
			await ask.save();
		}
		

		var offer1Prompt = 'What sectors/companies can you help connect classmates to?';
		if (user[offer1Prompt]){
			let offer = new Offer({
				owner : userModel,
				prompt : {
					community : demoCommunity,
					value : offer1Prompt
				},
				body : user[offer1Prompt],
				tags : user['OFFER: Sector'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
			});
			await offer.save();
		}

		var offer2Prompt = 'What resources or support are you willing to offer?';
		if (user[offer2Prompt]){
			let offer = new Offer({
				owner : userModel,
				prompt : {
					community : demoCommunity,
					value : offer2Prompt
				},
				body : user[offer2Prompt],
				tags : user['OFFER: Resources / Support'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
				
			});
			await offer.save();
		}


		console.log(userModel);
	}


	var lynds = await User.findOne({
		email : 'lyndseyb@alumni.gsb.stanford.edu',
	});
	lynds.password = 'msx18admin';
	lynds.isAdmin = true;
	await lynds.save();

	process.exit()
	
})().catch(err => console.error(err.stack));

