var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var eslint = require('gulp-eslint');
var nodemon = require('gulp-nodemon');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');

SRC = ['index.js', 'controllers/**/*.js']

/**
 * Runs travis tests and the pre-commit hook.
 */
var failOnLint = false;
gulp.task('angry-lint', function(cb) {
  failOnLint = true;
  runSequence(['lint'], cb);
});

gulp.task('run', function() {
  nodemon({
    script: 'index.js',
    ext: 'js',
    env: { 'DEBUG': '*' },
    execMap: {
      js: 'node --harmony'
    },
    watch: SRC
  })
  .on('change', ['lint', 'run'])
  .on('restart', function() {
    console.log('restarted!');
  });
});

/**
 * Runs linters on all javascript files found in the src dir.
 */
gulp.task('lint', function() {
  // Note: To have the process exit with an error code (1) on
  // lint error, return the stream and pipe to failOnError last.
  return gulp.src(SRC)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(failOnLint ? eslint.failOnError() : gutil.noop());
});

/**
 * Install pre-commit hook for app.
 */
gulp.task('pre-commit', function() {
  return gulp.src(['./pre-commit'])
    .pipe(gulp.dest('.git/hooks/'));
});

/**
 * The default task when `gulp` is run.
 * Adds a listener which will re-build on a file save.
 */
gulp.task('default', function() {
  runSequence('lint', 'run');
});

/**
 * Cleans all created files by this gulpfile, and node_modules.
 */
gulp.task('clean', function(cb) {
  del([
    'node_modules/'
  ], cb);
});
