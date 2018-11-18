/*
 * grunt-postmark-templates
 * push templates to a Postmark server for use with SendTemplatedEmail
 *
 * https://github.com/wildbit/grunt-postmark.git
 */

module.exports = function(grunt) {

  'use strict';

  grunt.registerMultiTask('postmark-templates', 'Create or update Postmark templates', function() {

    var done = this.async();
    var options = this.options();
    var template = this.data;

    var serverToken = options.serverToken || grunt.config('secrets.serverToken') || grunt.config('secret.postmark.server_token');

    if (!serverToken) {
      grunt.fail.warn('Missing required option "serverToken" \n');
    }

    template.name = template.name || this.target;

    if (!template.name) {
      grunt.fail.warn('Missing required template property "name" \n');
    }

    if (!template.subject) {
      grunt.fail.warn('Missing required template property "subject" \n');
    }

    if (!template.htmlBody && !template.htmlSrc) {
      grunt.log.error('Missing template property "htmlBody" or "htmlSrc"\n');
    }

    if (!template.textBody && !template.textSrc) {
      grunt.log.error('Missing template property "textBody" or "textSrc"\n');
    }

    var postmark = require('postmark');
    var client = new postmark.Client(serverToken);

    // read the referenced files, but hold on to the original filenames
    var expanded = {
      Name: template.name,
      Subject: template.subject,
      HtmlBody: template.htmlBody || grunt.file.read(template.htmlSrc),
      TextBody: template.textBody || grunt.file.read(template.textSrc),
      TemplateId: template.templateId
    };

    if (template.templateId) {
      client.editTemplate(template.templateId, expanded, function(err, response) {
        if (err && err.code === 1101) {
          grunt.log.warn('Template ' + template.templateId + ' not found, so attempting create');
          delete template.templateId;
          delete expanded.TemplateId;
          client.createTemplate(expanded, function(err, response) {
            if (err == null) {
              grunt.log.writeln('Template ' + JSON.stringify(template.name) + ' created: ' + JSON.stringify(response.TemplateId));
            } else {
              grunt.log.writeln('Error creating template ' + template.name + ': ' + JSON.stringify(err));
            }
            handleResponse(err, response, done, template);
          });
        } else {
          grunt.log.writeln('Template ' + template.name + ' updated: ' + JSON.stringify(response.TemplateId));
          handleResponse(err, response, done, template);
        }
      });
    } else {
      client.createTemplate(expanded, function(err, response) {
        grunt.log.writeln('Template ' + expanded.Name + ' created: ' + JSON.stringify(response.TemplateId));
        handleResponse(err, response, done, template);
      });
    }

  });

  function handleResponse(err, response, done, template) {
    if (err){
      errorMessage(err);
      done();
    } else {
      template.templateId = response.TemplateId;
      // append this record to the result array, used by postmark-templates-output task
      var upd = grunt.config.get('updatedTemplates') || {};
      var tname = template.name;
      delete template.name;
      upd[tname] = template;
      grunt.config.set('updatedTemplates', upd);

      done(template);
    }
  }

  function errorMessage(err) {
    if (err.message) {
      grunt.log.warn('Error: ' + err.message);
    } else {
      grunt.log.warn('Error: ' + JSON.stringify(err));
    }
  }

  // invoke this task after postmark-templates to get an output file containing the resulting template IDs
  // this is in the same format as the postmark-templates config.

  grunt.registerTask('postmark-templates-output', 'writes out the resulting template IDs', function() {

    var options = this.options({
      filename: "templates-output.json"
    });

    var results = grunt.config('updatedTemplates');

    grunt.file.write(options.filename, JSON.stringify(results, null, 2));

    grunt.log.writeln("Updated template information written to " + options.filename);

  });

};
