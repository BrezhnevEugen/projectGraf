$(document).ready(function () {
  $('#login-form').on('submit', function (e) {
    e.preventDefault();
    $.ajax({ url: '/api/login', method: 'POST' });
  });

  $('.menu-toggle').on('click', function () {
    $('.sidebar').toggleClass('open');
  });
});
