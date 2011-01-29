// Include BinaryParser
if(typeof(BinaryParser) == "undefined") {
	var head = document.getElementsByTagName("head")[0];
	var BinaryParserScript = document.createElement("script");
	BinaryParserScript.src = "binary-parser.js";
	BinaryParserScript.type = "text/javascript";
	head.appendChild(BinaryParserScript);
}
// Include GZIP
if(typeof(GZip) == "undefined") {
	var head = document.getElementsByTagName("head")[0];
	var GZipScript = document.createElement("script");
	GZipScript.src = "gzip.js";
	GZipScript.type = "text/javascript";
	head.appendChild(GZipScript);
}
// Include BigNumber - Javascript lacks the ability to handle 64-bit integers, so we must use an AP math library.
if(typeof(BigNumber) == "undefined") {
	var head = document.getElementsByTagName("head")[0];
	var BigNumberScript = document.createElement("script");
	BigNumberScript.src = "bignumber.js";
	BigNumberScript.type = "text/javascript";
	head.appendChild(BigNumberScript);
}

NBT = function(nbtfile) {
	this.binary = new BinaryParser(true);
	if(nbtfile) this.loadFile(nbtfile);
}; with({nbtproto: NBT.prototype}) {
	nbtproto.root = new Array();

	nbtproto.tags = {
		TAG_END: 0,
		TAG_BYTE: 1,
		TAG_SHORT: 2,
		TAG_INT: 3,
		TAG_LONG: 4,
		TAG_FLOAT: 5,
		TAG_DOUBLE: 6,
		TAG_BYTE_ARRAY: 7,
		TAG_STRING: 8,
		TAG_LIST: 9,
		TAG_COMPOUND: 10
	};
	
	nbtproto.loadFile = function(nbtfile, compressed) {
		if(typeof(compressed) == "undefined") compressed = true;
		if(compressed) nbtfile = GZip.load(nbtfile);
		var filestring = new StringStream(nbtfile.data[0]);
		this.traverseTag(filestring, this.root);
		return this.root[this.root.length - 1];
	}
	
	nbtproto.purge = function() {
		this.root = new Array();
	}
	
	nbtproto.traverseTag = function(nbtfile, tree) {
		if(nbtfile.eof()) return false;
		var tagType = this.readType(nbtfile, this.tags.TAG_BYTE);
		if(tagType == this.tags.TAG_END) {
			return false;
		} else {
			var tagName = this.readType(nbtfile, this.tags.TAG_STRING);
			var tagData = this.readType(nbtfile, tagType);
			tree.push({
				type: tagType,
				name: tagName,
				value: tagData
			});
			return true;
		}
	}
	
	nbtproto.readType = function(nbtfile, type) {
		switch(type) {
			case this.tags.TAG_BYTE:
				return this.binary.toSmall(nbtfile.read(1));
			case this.tags.TAG_SHORT:
				return this.binary.toShort(nbtfile.read(2));
			case this.tags.TAG_INT:
				return this.binary.toInt(nbtfile.read(4));
			case this.tags.TAG_LONG:
				var firstHalf = new BigNumber(this.binary.toDWord(nbtfile.read(4)));
				var secondHalf = new BigNumber(this.binary.toDWord(nbtfile.read(4)));
				var result = secondHalf.add(firstHalf.multiply(4294967296));
				var signCheck = new BigNumber(2);
				signCheck = signCheck.pow(63);
				var signSub = new BigNumber(2);
				signSub = signSub.pow(64);
				if(result.compare(signCheck) >= 0) result = result.subtract(signSub);
				return result;
			case this.tags.TAG_FLOAT:
				return this.binary.toFloat(nbtfile.read(4));
			case this.tags.TAG_DOUBLE:
				return this.binary.toDouble(nbtfile.read(8));
			case this.tags.TAG_BYTE_ARRAY:
				var arrayLength = this.readType(nbtfile, this.tags.TAG_INT);
				var byteArray = new Array();
				for(var i = 0; i < arrayLength; i++) byteArray.push(this.readType(nbtfile, this.tags.TAG_BYTE));
				return byteArray;
			case this.tags.TAG_STRING:
				var stringLength = this.readType(nbtfile, this.tags.TAG_SHORT);
				if(!stringLength) return "";
				return decodeURIComponent(escape(nbtfile.read(stringLength)));
			case this.tags.TAG_LIST:
				var tagType = this.readType(nbtfile, this.tags.TAG_BYTE);
				var listLength = this.readType(nbtfile, this.tags.TAG_INT);
				var list = {
					type: tagType,
					value: new Array()
				}
				for(var i = 0; i < listLength; i++) {
					if(nbtfile.eof()) break;
					list.value.push(this.readType(nbtfile, tagType));
				}
				return list;
			case this.tags.TAG_COMPOUND:
				var tree = new Array();
				while(this.traverseTag(nbtfile, tree)) {}
				return tree;
		}
	}
}

StringStream = function(string) {
	this.string = string;
	this.position = 0;
}; with({proto: StringStream.prototype}) {
	proto.read = function(bytes) {
		var data = this.string.substr(this.position, bytes);
		this.position += bytes;
		return data;
	}
	
	proto.seek = function(bytes) {
		this.position += bytes;
		return true;
	}
	
	proto.rewind = function() {
		this.position = 0;
		return true;
	}
	
	proto.tell = function() {
		return this.position;
	}
	
	proto.eof = function() {
		return (this.position >= this.string.length);
	}
}
